from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.auditoria.services import registrar
from .models import Animal, Lote


def actualizar_conteo_lote(lote):
    """Recalcula cantidad_actual de un lote según sus animales activos."""
    lote.cantidad_actual = Animal.objects.filter(lote=lote, estado='ACTIVO').count()
    lote.save(update_fields=['cantidad_actual'])
    return lote


@transaction.atomic
def marcar_fallecido(animal, usuario, observaciones=''):
    """Registra la muerte de un animal y actualiza el lote (RN-LO-03)."""
    if animal.estado != 'ACTIVO':
        raise ValidationError(f'El animal está en estado {animal.estado} y no puede marcarse como fallecido.')

    animal.estado = 'FALLECIDO'
    if observaciones:
        animal.observaciones = (animal.observaciones or '') + f'\nFallecido: {observaciones}'
    animal.save(update_fields=['estado', 'observaciones'])

    actualizar_conteo_lote(animal.lote)
    registrar(
        usuario=usuario,
        accion='FALLECER',
        modelo='Animal',
        objeto_id=animal.pk,
        datos_nuevos={'estado': 'FALLECIDO', 'lote_id': animal.lote_id},
    )
    return animal


@transaction.atomic
def dividir_lote(lote, nuevo_codigo, animales_ids, usuario, fecha=None, observaciones=''):
    """Divide un lote: crea un lote derivado con el grupo indicado (RN-LO-06/07)."""
    if lote.estado != 'ACTIVO':
        raise ValidationError('Solo es posible dividir lotes activos.')

    if not animales_ids:
        raise ValidationError('Debe indicar al menos un animal para el lote derivado.')

    animales = list(
        Animal.objects.filter(pk__in=animales_ids, lote=lote, estado='ACTIVO')
    )
    if len(animales) != len(set(animales_ids)):
        raise ValidationError('Algunos animales indicados no pertenecen al lote o no están activos.')

    derivado = Lote.objects.create(
        codigo=nuevo_codigo,
        lote_origen=lote,
        fecha_ingreso=fecha or lote.fecha_ingreso,
        cantidad_original=len(animales),
        cantidad_actual=len(animales),
        estado='ACTIVO',
        observaciones=observaciones or f'División del lote {lote.codigo}',
    )

    Animal.objects.filter(pk__in=[a.pk for a in animales]).update(lote=derivado)
    actualizar_conteo_lote(lote)

    registrar(
        usuario=usuario,
        accion='DIVIDIR',
        modelo='Lote',
        objeto_id=lote.pk,
        datos_nuevos={
            'lote_derivado_id': derivado.pk,
            'lote_derivado_codigo': derivado.codigo,
            'n_animales': len(animales),
            'lote_origen_restantes': lote.cantidad_actual,
        },
    )
    return derivado