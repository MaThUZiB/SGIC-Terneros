from django.db import transaction

from apps.inventario.models import MovimientoInventario
from apps.inventario.services import InventarioService
from apps.auditoria.services import registrar
from .models import Tratamiento


@transaction.atomic
def registrar_tratamiento(data, usuario):
    """Registra un tratamiento. Si tiene cantidad, descuenta inventario del medicamento."""
    tratamiento = Tratamiento(
        animal=data['animal'],
        producto=data['producto'],
        fecha=data['fecha'],
        cantidad=data.get('cantidad'),
        motivo=data.get('motivo'),
        observaciones=data.get('observaciones', ''),
        costo_total=None,
    )

    movimiento = None
    if tratamiento.cantidad:
        movimiento = InventarioService.salida(
            producto_id=tratamiento.producto_id,
            cantidad=tratamiento.cantidad,
            usuario=usuario,
            referencia_tipo='TRATAMIENTO',
            referencia_id=None,
            observaciones=f'Tratamiento: {tratamiento.motivo}',
        )
        tratamiento.costo_total = movimiento.costo_total

    tratamiento.save()

    if movimiento:
        MovimientoInventario.objects.filter(pk=movimiento.pk).update(
            referencia_id=tratamiento.pk)

    registrar(
        usuario=usuario,
        accion='CREAR',
        modelo='Tratamiento',
        objeto_id=tratamiento.pk,
        datos_nuevos={'animal_id': tratamiento.animal_id, 'producto_id': tratamiento.producto_id},
    )
    return tratamiento