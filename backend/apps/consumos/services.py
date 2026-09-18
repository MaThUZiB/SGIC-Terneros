from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.inventario.models import Producto
from apps.inventario.services import InventarioService
from apps.auditoria.services import registrar
from apps.alimentacion.models import AsignacionPlanLote
from .models import Consumo, DetalleConsumo


def _aplicar_detalles(consumo, detalles_data, usuario):
    total_costo = Decimal('0.00')
    filas = []
    for item in detalles_data:
        producto = item['producto']
        cantidad = Decimal(item['cantidad'])
        if cantidad <= 0:
            raise ValidationError('La cantidad de consumo debe ser mayor que cero.')

        movimiento = InventarioService.salida(
            producto_id=producto.pk,
            cantidad=cantidad,
            usuario=usuario,
            referencia_tipo='CONSUMO',
            referencia_id=consumo.pk,
            observaciones=f'Consumo #{consumo.pk}',
        )
        filas.append(DetalleConsumo(
            consumo=consumo,
            producto=producto,
            cantidad=cantidad,
            unidad=item.get('unidad') or producto.unidad_base,
            costo_unitario=movimiento.costo_unitario,
            costo_total=movimiento.costo_total,
        ))
        total_costo += movimiento.costo_total

    DetalleConsumo.objects.bulk_create(filas)
    return total_costo


@transaction.atomic
def registrar_consumo(data, usuario):
    """Registra un consumo real (o ajuste) y descuenta inventario."""
    detalles_data = data.get('detalles') or []
    if not detalles_data:
        raise ValidationError({'detalles': 'Debe indicar al menos un detalle.'})

    consumo = Consumo.objects.create(
        lote=data.get('lote'),
        fecha=data.get('fecha'),
        origen=data.get('origen', 'REAL'),
        usuario=usuario,
        observaciones=data.get('observaciones', ''),
    )

    _aplicar_detalles(consumo, detalles_data, usuario)
    registrar(
        usuario=usuario,
        accion='CREAR',
        modelo='Consumo',
        objeto_id=consumo.pk,
        datos_nuevos={'origen': consumo.origen, 'lote_id': consumo.lote_id},
    )
    return consumo


@transaction.atomic
def generar_consumo_desde_plan(asignacion, usuario, fecha, observaciones=''):
    """Genera el consumo habitual a partir de los detalles del plan activo."""
    if not asignacion.activo:
        raise ValidationError('La asignación del plan no está activa.')

    detalles_plan = list(asignacion.plan.detalles.select_related('producto', 'unidad').all())
    if not detalles_plan:
        raise ValidationError('El plan no tiene detalles de consumo.')

    consumo = Consumo.objects.create(
        lote=asignacion.lote,
        fecha=fecha,
        origen='PLAN',
        usuario=usuario,
        observaciones=observaciones or f'Consumo habitual del plan {asignacion.plan.nombre}',
    )

    data = [
        {'producto': d.producto, 'cantidad': d.cantidad_diaria, 'unidad': d.unidad}
        for d in detalles_plan
    ]
    _aplicar_detalles(consumo, data, usuario)
    registrar(
        usuario=usuario,
        accion='CREAR',
        modelo='Consumo',
        objeto_id=consumo.pk,
        datos_nuevos={'origen': 'PLAN', 'asignacion_id': asignacion.pk, 'lote_id': asignacion.lote_id},
    )
    return consumo