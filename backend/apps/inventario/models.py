from django.db import models
from django.conf import settings


class CategoriaProducto(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'categoria_producto'
        verbose_name = 'Categoría de Producto'
        verbose_name_plural = 'Categorías de Productos'

    def __str__(self):
        return self.nombre


class UnidadMedida(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=50)
    tipo = models.CharField(max_length=30)
    decimales = models.IntegerField(default=2)

    class Meta:
        db_table = 'unidad_medida'
        verbose_name = 'Unidad de Medida'
        verbose_name_plural = 'Unidades de Medida'

    def __str__(self):
        return f"{self.nombre} ({self.codigo})"


class Producto(models.Model):
    nombre = models.CharField(max_length=120)
    categoria = models.ForeignKey(CategoriaProducto, on_delete=models.PROTECT)
    unidad_base = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT)
    stock_actual = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    costo_promedio = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # PMP
    activo = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'producto'
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'

    def __str__(self):
        return self.nombre


class PresentacionProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='presentaciones')
    nombre = models.CharField(max_length=80)
    cantidad_base = models.DecimalField(max_digits=12, decimal_places=3)
    unidad_base = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = 'presentacion_producto'
        verbose_name = 'Presentación de Producto'
        verbose_name_plural = 'Presentaciones de Productos'


class ConversionProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='conversiones')
    cantidad_origen = models.DecimalField(max_digits=12, decimal_places=4)
    unidad_origen = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT, related_name='conversion_origen')
    cantidad_destino = models.DecimalField(max_digits=12, decimal_places=4)
    unidad_destino = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT, related_name='conversion_destino')
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = 'conversion_producto'
        verbose_name = 'Conversión de Producto'
        verbose_name_plural = 'Conversiones de Productos'


class MovimientoInventario(models.Model):
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
        ('AJUSTE', 'Ajuste'),
    ]

    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='movimientos')
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    referencia_tipo = models.CharField(max_length=50)
    referencia_id = models.BigIntegerField(null=True, blank=True)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'movimiento_inventario'
        verbose_name = 'Movimiento de Inventario'
        verbose_name_plural = 'Movimientos de Inventario'