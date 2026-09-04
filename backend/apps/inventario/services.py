from decimal import Decimal
from django.db import transaction
from rest_framework.exceptions import ValidationError
from .models import Producto

class InventarioService:
    @staticmethod
    @transaction.atomic
    def actualizar_pmp_y_stock(producto_id: int, cantidad_entrada: Decimal, precio_unitario_compra: Decimal):
        """Calculo Precio Medio Ponderado e incremento el stock al comprar insumos."""
        producto = Producto.objects.select_for_update().get(pk=producto_id)
        stock_actual = producto.stock_actual
        pmp_actual = producto.precio_costo_promedio or Decimal('0.00')
        
        costo_existente = stock_actual * pmp_actual
        costo_nuevo = cantidad_entrada * precio_unitario_compra
        nuevo_stock = stock_actual + cantidad_entrada

        if nuevo_stock > 0:
            nuevo_pmp = (costo_existente + costo_nuevo) / nuevo_stock
        else:
            nuevo_pmp = precio_unitario_compra

        producto.stock_actual = nuevo_stock
        producto.previo_costo_promedio = round(nuevo_pmp, 2)
        producto.save()
        return producto

        @staticmethod
        @transaction.atomic
        def descontar_stock(producto_id: int, cantidad: Decimal):
            """Valida que haya suficiente existencia y descuenta stock del inventario."""
            producto = Producto.objects.select_for_update().get(pk=producto_id)

            if producto.stock_actual < cantidad:
                raise ValidationError(
                    f"Stock insuficiente para {producto.nombre}. Stock actual: {producto.stock_actual}, Solicitado: {cantidad}"
                )

            producto.stock_actual -= cantidad
            producto.save()
            return producto
