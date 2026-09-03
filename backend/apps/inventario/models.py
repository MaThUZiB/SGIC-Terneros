from django.db import models
from django.conf import settings

# Create your models here.
class CategoriaProducto(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Categoría de Producto"
        verbose_name_plural = "Categorías de Productos"
    
    def __str__(self):
        return self.nombre


class UnidadMedida(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=50)
    tipo = models.CharField(max_length=30)
    decimales = models.IntegerField(default=2)

    class Meta:
        verbose_name = "Unidad de Medida"
        verbose_name_plural = "Unidades de Medida"

    def __str__(self):
        return f"{self.nombre} ({self.codigo})"


class Producto(models.Model):
    nombre = models.CharField(max_length=120)
    categoria = models.ForeignKey(CategoriaProducto, on_delete=models.PROTECT, related_name='productos')
    unidad_base = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT, related_name= 'productos')
    stock_actual = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    costo_promedio = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"

    def __str__(self):
        return self.nombre

class PresentacionProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='presentaciones')
    nombre = models.CharField(max_length=80)
    cantidad_base = models.DecimalField(max_digits=12, decimal_places=3)
    unidad_base = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT)
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Presentacion de Producto"
        verbose_name_plural = "Presentaciones de Productos"

    def __str__(self):
        return f"{self.producto.nombre} - {self.nombre}"

class ConversionProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='conversiones')
    cantidad_origen = models.DecimalField(max_digits=12, decimal_places=4)
    unidad_origen = models.ForeignKey(UnidadMedida, on_delete= models.PROTECT, related_name='conversiones_origen')
    cantidad_destino = models.DecimalField(max_digits=12, decimal_places=4)
    unidad_destino = models.ForeignKey(UnidadMedida, on_delete = models.PROTECT, related_name='conversiones_destino')
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Conversion de Producto"
        verbose_name_plural = "Conversiones de Productos"

class MovimientoInventario(models.Model):
    TIPOS_MOVIMIENTO = [
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
        ('AJUSTE', 'Ajuste'),
    ]

    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='movimiento')
    tipo = models.CharField(max_length=30, choices=TIPOS_MOVIMIENTO)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    referencia_tipo = models.CharField(max_length=50)
    referencia_id = models.BigIntegerField(blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Movimiento de Inventario"
        verbose_name_plural = "Movimientos de Inventario"

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} ({self.cantidad})"
