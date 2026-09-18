from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.inventario.services import InventarioService
from apps.auditoria.services import registrar
from .models import CompraInsumo, DetalleCompraInsumo


def _preparar_detalle(detalle):
    """Convierte presentaciones a unidad base y calcula subtotal."""
    cantidad = Decimal(detalle['cantidad'])
    cantidad_base = detalle.get('cantidad_base')
    if cantidad_base is None and detalle.get('presentacion'):
        cantidad_base = cantidad * detalle['presentacion'].cantidad_base
    cantidad_base = Decimal(cantidad_base or cantidad)

    precio_unitario = Decimal(detalle.get('precio_unitario') or '0')
    subtotal = (cantidad_base * precio_unitario).quantize(Decimal('0.01'))
    return cantidad, cantidad_base, precio_unitario, subtotal


@transaction.atomic
def crear_compra(data, usuario, compra_id=None):
    """Crea una compra de insumos en estado BORRADOR (no mueve inventario)."""
    detalles_data = data.get('detalles') or []
    if not detalles_data:
        raise ValidationError({'detalles': 'Debe indicar al menos un detalle.'})

    compra = CompraInsumo.objects.create(
        proveedor=data['proveedor'],
        fecha=data.get('fecha'),
        numero_documento=data.get('numero_documento') or None,
        estado='BORRADOR',
        total=Decimal('0.00'),
        observaciones=data.get('observaciones', ''),
    )

    total = Decimal('0.00')
    filas = []
    for detalle in detalles_data:
        cantidad, cantidad_base, precio_unitario, subtotal = _preparar_detalle(detalle)
        filas.append(
            DetalleCompraInsumo(
                compra=compra,
                producto=detalle['producto'],
                presentacion=detalle.get('presentacion'),
                cantidad=cantidad,
                cantidad_base=cantidad_base,
                precio_unitario=precio_unitario,
                subtotal=subtotal,
            )
        )
        total += subtotal

    DetalleCompraInsumo.objects.bulk_create(filas)
    compra.total = total
    compra.save(update_fields=['total'])
    return compra


@transaction.atomic
def confirmar_compra(compra, usuario):
    """Confirma la compra: genera entradas de inventario y actualiza stock + PMP."""
    if compra.estado != 'BORRADOR':
        raise ValidationError(f'La compra está en estado {compra.estado} y no puede confirmarse.')

    detalles = list(compra.detalles.select_related('producto', 'presentacion').all())
    total = Decimal('0.00')
    for detalle in detalles:
        if detalle.cantidad_base is None or detalle.subtotal is None:
            _, cantidad_base, precio_unitario, subtotal = _preparar_detalle({
                'cantidad': detalle.cantidad,
                'cantidad_base': detalle.cantidad_base,
                'presentacion': detalle.presentacion,
                'precio_unitario': detalle.precio_unitario,
            })
            detalle.cantidad_base = cantidad_base
            detalle.subtotal = subtotal
            detalle.save()
        total += detalle.subtotal
        InventarioService.entrada(
            producto_id=detalle.producto_id,
            cantidad=detalle.cantidad_base,
            costo_unitario=detalle.precio_unitario,
            usuario=usuario,
            referencia_tipo='COMPRA_INSUMO',
            referencia_id=compra.pk,
            observaciones=f'Compra insumo #{compra.pk}',
        )
    compra.total = total
    compra.estado = 'CONFIRMADA'
    compra.save(update_fields=['total', 'estado'])

    registrar(
        usuario=usuario,
        accion='CONFIRMAR',
        modelo='CompraInsumo',
        objeto_id=compra.pk,
        datos_nuevos={'total': str(compra.total), 'detalles': len(detalles)},
    )
    return compra


@transaction.atomic
def anular_compra(compra, usuario):
    """Anula una compra en BORRADOR (aún no ha movido inventario)."""
    if compra.estado != 'BORRADOR':
        raise ValidationError(
            f'La compra está en estado {compra.estado}. Si ya movió inventario, '
            'no puede anularse; registre un ajuste manual para corregir.'
        )
    compra.estado = 'ANULADA'
    compra.save(update_fields=['estado'])
    registrar(usuario=usuario, accion='ANULAR', modelo='CompraInsumo', objeto_id=compra.pk)
    return compra