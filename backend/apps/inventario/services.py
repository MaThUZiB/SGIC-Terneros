from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Producto, MovimientoInventario


class InventarioService:
    """Servicio que centraliza todas las variaciones de stock.

    Toda variación de inventario DEBE pasar por estos métodos para que se
    registre el movimiento correspondiente (RN-IN-02, RN-IN-06) y el PMP.
    """

    @staticmethod
    @transaction.atomic
    def entrada(producto_id, cantidad, costo_unitario, usuario, referencia_tipo='COMPRA_INSUMO',
                referencia_id=None, observaciones=None):
        """Entrada de stock por compra. Actualiza stock y recalcula el PMP."""
        producto = Producto.objects.select_for_update().get(pk=producto_id)
        cantidad = Decimal(cantidad)
        costo_unitario = Decimal(costo_unitario)

        stock_actual = producto.stock_actual
        pmp_actual = producto.costo_promedio or Decimal('0.00')

        costo_existente = stock_actual * pmp_actual
        costo_nuevo = cantidad * costo_unitario
        nuevo_stock = stock_actual + cantidad

        if nuevo_stock > 0:
            nuevo_pmp = (costo_existente + costo_nuevo) / nuevo_stock
        else:
            nuevo_pmp = costo_unitario

        producto.stock_actual = nuevo_stock
        producto.costo_promedio = nuevo_pmp.quantize(Decimal('0.01'))
        producto.save()

        return MovimientoInventario.objects.create(
            producto=producto,
            tipo='ENTRADA',
            cantidad=cantidad,
            costo_unitario=costo_unitario,
            costo_total=costo_nuevo,
            usuario=usuario,
            referencia_tipo=referencia_tipo,
            referencia_id=referencia_id,
            observaciones=observaciones,
        )

    @staticmethod
    @transaction.atomic
    def salida(producto_id, cantidad, usuario, referencia_tipo='CONSUMO', referencia_id=None,
               observaciones=None, validar_stock=True):
        """Salida de stock (consumo, tratamiento, venta). Aplica el PMP actual."""
        producto = Producto.objects.select_for_update().get(pk=producto_id)
        cantidad = Decimal(cantidad)

        if cantidad <= 0:
            raise ValidationError('La cantidad de salida debe ser mayor que cero.')

        if validar_stock and producto.stock_actual < cantidad:
            raise ValidationError(
                f'Stock insuficiente para {producto.nombre}. '
                f'Stock actual: {producto.stock_actual}, solicitado: {cantidad}'
            )

        pmp = producto.costo_promedio or Decimal('0.00')
        costo_total = cantidad * pmp

        producto.stock_actual -= cantidad
        producto.save()

        return MovimientoInventario.objects.create(
            producto=producto,
            tipo='SALIDA',
            cantidad=cantidad,
            costo_unitario=pmp,
            costo_total=costo_total.quantize(Decimal('0.01')),
            usuario=usuario,
            referencia_tipo=referencia_tipo,
            referencia_id=referencia_id,
            observaciones=observaciones,
        )

    @staticmethod
    @transaction.atomic
    def ajuste(producto_id, cantidad, usuario, motivo='', observaciones=None):
        """Ajuste manual (merma, corrección). cantidad puede ser negativa o positiva."""
        producto = Producto.objects.select_for_update().get(pk=producto_id)
        cantidad = Decimal(cantidad)

        nuevo_stock = producto.stock_actual + cantidad
        if nuevo_stock < 0:
            raise ValidationError(
                f'El ajuste dejaría stock negativo para {producto.nombre} '
                f'(stock actual: {producto.stock_actual}).'
            )

        pmp = producto.costo_promedio or Decimal('0.00')
        producto.stock_actual = nuevo_stock
        producto.save()

        return MovimientoInventario.objects.create(
            producto=producto,
            tipo='AJUSTE',
            cantidad=cantidad,
            costo_unitario=pmp,
            costo_total=(cantidad * pmp).quantize(Decimal('0.01')),
            usuario=usuario,
            referencia_tipo='AJUSTE_MANUAL',
            referencia_id=None,
            observaciones=f'{motivo} {observaciones or ""}'.strip() or None,
        )