from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.ganaderia.models import Animal
from apps.ganaderia.services import actualizar_conteo_lote
from apps.consumos.models import DetalleConsumo
from apps.gastos.models import Gasto
from apps.sanidad.models import Tratamiento
from apps.auditoria.services import registrar
from .models import Venta, DetalleVenta

CENTAVO = Decimal('0.01')


def _q(valor):
    return Decimal(valor).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def desglose_costo_lote(lote):
    """Devuelve el desglose de costos acumulados de un lote (RN-CT-01..05)."""
    adquisicion = sum(
        (a.precio_adquisicion for a in lote.animales.all()), Decimal('0.00'))

    alimentacion = sum(
        (d.costo_total for d in DetalleConsumo.objects.filter(consumo__lote=lote)),
        Decimal('0.00'))

    sanidad = sum(
        (t.costo_total or Decimal('0.00') for t in Tratamiento.objects.filter(animal__lote=lote)),
        Decimal('0.00'))

    gastos = sum(
        (g.monto for g in Gasto.objects.filter(lote=lote)), Decimal('0.00'))

    return {
        'adquisicion': _q(adquisicion),
        'alimentacion': _q(alimentacion),
        'sanidad': _q(sanidad),
        'gastos_imputables': _q(gastos),
        'costo_total': _q(adquisicion + alimentacion + sanidad + gastos),
    }


def _detalle_venta_rows(venta, detalles_data):
    total_animales = sum(int(d['cantidad_animales']) for d in detalles_data)
    if total_animales <= 0:
        raise ValidationError('La cantidad total de animales debe ser mayor que cero.')

    filas = []
    for d in detalles_data:
        lote = d['lote']
        cantidad = int(d['cantidad_animales'])
        if cantidad <= 0:
            raise ValidationError('La cantidad de animales por lote debe ser mayor que cero.')
        activos = lote.animales.filter(estado='ACTIVO').count()
        if cantidad > activos:
            raise ValidationError(
                f'El lote {lote.codigo} solo tiene {activos} animales activos; '
                f'se intentó vender {cantidad}.')
        ingreso = venta.total_venta * Decimal(cantidad) / Decimal(total_animales)
        filas.append(DetalleVenta(
            venta=venta,
            lote=lote,
            cantidad_animales=cantidad,
            ingreso=_q(ingreso),
            costo_reconocido=Decimal('0.00'),
            utilidad=Decimal('0.00'),
        ))
    return filas


@transaction.atomic
def crear_venta(data, usuario, venta_id=None):
    """Crea la venta en estado BORRADOR (aún no cierra los lotes)."""
    detalles_data = data.get('detalles') or []
    if not detalles_data:
        raise ValidationError({'detalles': 'Debe indicar al menos un lote a vender.'})

    total_venta = data.get('total_venta')
    peso = data.get('peso_total_kg')
    precio = data.get('precio_kg')
    if total_venta is None:
        if peso and precio:
            total_venta = Decimal(peso) * Decimal(precio)
        else:
            raise ValidationError({'total_venta': 'Indique el total de la venta (o peso y precio por kg).'})

    venta = Venta.objects.create(
        fecha=data['fecha'],
        comprador=data.get('comprador') or None,
        peso_total_kg=peso or None,
        precio_kg=precio or None,
        total_venta=_q(total_venta),
        estado='BORRADOR',
        observaciones=data.get('observaciones', ''),
    )

    DetalleVenta.objects.bulk_create(_detalle_venta_rows(venta, detalles_data))
    return venta


@transaction.atomic
def confirmar_venta(venta, usuario):
    """Confirma la venta: cierra el grupo, congela costo reconocido y utilidad (RN-VE-06)."""
    if venta.estado != 'BORRADOR':
        raise ValidationError(f'La venta está en estado {venta.estado} y no puede confirmarse.')

    detalles = list(venta.detalles.select_related('lote').all())
    if not detalles:
        raise ValidationError('La venta no tiene detalles.')

    for detalle in detalles:
        lote = detalle.lote
        cantidad = detalle.cantidad_animales

        activos = list(lote.animales.filter(estado='ACTIVO').order_by('id'))
        if cantidad > len(activos):
            raise ValidationError(
                f'El lote {lote.codigo} solo tiene {len(activos)} animales activos.')
        a_vender = activos[:cantidad]

        adquisicion_vendida = sum((a.precio_adquisicion for a in a_vender), Decimal('0.00'))
        desglose = desglose_costo_lote(lote)
        compartidos = desglose['alimentacion'] + desglose['sanidad'] + desglose['gastos_imputables']
        if len(activos) > 0:
            proporcion = Decimal(cantidad) / Decimal(len(activos))
        else:
            proporcion = Decimal('1')
        costo_reconocido = _q(adquisicion_vendida + compartidos * proporcion)

        detalle.costo_reconocido = costo_reconocido
        detalle.utilidad = _q(detalle.ingreso - costo_reconocido)
        detalle.save(update_fields=['costo_reconocido', 'utilidad'])

        Animal.objects.filter(pk__in=[a.pk for a in a_vender]).update(estado='VENDIDO')
        actualizar_conteo_lote(lote)
        if lote.cantidad_actual == 0:
            lote.estado = 'CERRADO'
            lote.save(update_fields=['estado'])

    venta.estado = 'CONFIRMADA'
    venta.save(update_fields=['estado'])

    registrar(
        usuario=usuario,
        accion='CONFIRMAR',
        modelo='Venta',
        objeto_id=venta.pk,
        datos_nuevos={'total': str(venta.total_venta), 'lotes': [d.lote.codigo for d in detalles]},
    )
    return venta


@transaction.atomic
def anular_venta(venta, usuario):
    """Anula una venta en BORRADOR. Una venta confirmada no se revierte por edición."""
    if venta.estado != 'BORRADOR':
        raise ValidationError(
            f'La venta está en estado {venta.estado} y no puede anularse.')
    venta.estado = 'ANULADA'
    venta.save(update_fields=['estado'])
    registrar(usuario=usuario, accion='ANULAR', modelo='Venta', objeto_id=venta.pk)
    return venta