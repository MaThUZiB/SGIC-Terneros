from django.db import models

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