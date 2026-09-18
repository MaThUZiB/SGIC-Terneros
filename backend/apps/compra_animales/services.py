from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.ganaderia.models import Lote, Animal
from apps.auditoria.services import registrar
from .models import CompraAnimal, DetalleCompraAnimal


def _crear_lote(data, fecha):
    lote = Lote.objects.create(
        codigo=data['codigo'],
        fecha_ingreso=data.get('fecha_ingreso', fecha),
        cantidad_original=0,
        cantidad_actual=0,
        observaciones=data.get('observaciones', ''),
    )
    return lote


@transaction.atomic
def registrar_compra(data, usuario):
    """Registra una compra grupal de animales.

    Si llega ``lote_nuevo`` se crea un lote a partir de la compra (flujo normal).
    Si llega ``lote`` (existente) la operación se trata como incorporación
    excepcional y los animales se agregan a ese lote conservando su costo.
    """
    animales_data = data.get('animales') or []
    if not animales_data:
        raise ValidationError({'animales': 'Debe indicar al menos un animal.'})

    fecha = data.get('fecha')
    proveedor = data.get('proveedor')

    lote_nuevo = data.get('lote_nuevo')
    lote_existente_id = data.get('lote')

    if lote_nuevo:
        lote = _crear_lote(lote_nuevo, fecha)
        es_incorporacion = False
    elif lote_existente_id:
        lote = Lote.objects.select_for_update().get(
            pk=getattr(lote_existente_id, 'pk', lote_existente_id))
        es_incorporacion = True
    else:
        raise ValidationError({'lote_nuevo': 'Debe indicar un lote nuevo o un lote existente.'})

    compra = CompraAnimal.objects.create(
        fecha=fecha,
        proveedor_id=getattr(proveedor, 'pk', proveedor) if proveedor else None,
        total=Decimal('0.00'),
        observaciones=data.get('observaciones', ''),
    )

    total = Decimal('0.00')
    detalles = []
    for item in animales_data:
        diio = (item.get('diio') or '').strip()
        if not diio:
            raise ValidationError({'animales': 'Cada animal debe tener DIIO.'})
        precio = Decimal(item.get('precio_adquisicion') or '0')

        animal = Animal(
            diio=diio,
            lote=lote,
            raza=item['raza'],
            sexo=item.get('sexo'),
            fecha_nacimiento=item.get('fecha_nacimiento') or None,
            edad_aproximada_dias=item.get('edad_aproximada_dias') or 0,
            fecha_adquisicion=item.get('fecha_adquisicion', fecha),
            precio_adquisicion=precio,
            peso_ingreso_kg=item.get('peso_ingreso_kg') or None,
            observaciones=item.get('observaciones', ''),
        )
        animal.full_clean()
        animal.save()

        detalles.append(DetalleCompraAnimal(
            compra=compra,
            animal=animal,
            precio_adquisicion=precio,
            peso_compra=item.get('peso_ingreso_kg') or None,
        ))
        total += precio

    DetalleCompraAnimal.objects.bulk_create(detalles)
    compra.total = total
    compra.save(update_fields=['total'])

    if es_incorporacion:
        lote.cantidad_actual = Animal.objects.filter(lote=lote, estado='ACTIVO').count()
        lote.save(update_fields=['cantidad_actual'])
    else:
        lote.cantidad_original = len(animales_data)
        lote.cantidad_actual = len(animales_data)
        lote.save(update_fields=['cantidad_original', 'cantidad_actual'])

    registrar(
        usuario=usuario,
        accion='CREAR' if not es_incorporacion else 'INCORPORAR',
        modelo='CompraAnimal',
        objeto_id=compra.pk,
        datos_nuevos={'total': str(total), 'n_animales': len(animales_data), 'lote_id': lote.pk},
    )

    return compra