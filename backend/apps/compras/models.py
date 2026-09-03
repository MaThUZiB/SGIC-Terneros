from django.db import models
from apps.animales.models import Animal

# Create your models here.
class Proveedor(models.Model):
    nombre = models.CharField(max_length=150)
    rut = models.CharField(max_length=20, blank=True, null=True)
    telefono = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"

    def __str__(self):
        return self.nombre

class CompraAnimal(models.Model):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name='compras_animales', blank=True, null=True)
    fecha = models.DateField()
    total = models.DecimalField(max_digits=12, decimal_places=2)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Compra de Animal"
        verbose_name_plural = "Compras de Animales"

    def __str__(self):
        return f"Compra de Animales #{self.id} - {self.fecha}"

class DetalleCompraAnimal(models.Model):
    compra = models.ForeignKey(CompraAnimal, on_delete=models.CASCADE, related_name='detalles')
    animal = models.ForeignKey(Animal, on_delete=models.PROTECT, related_name='detalle_compra')
    precio_adquisicion = models.DecimalField(max_digits=12, decimal_places=2)
    peso_compra_kg = models.DecimalField(max_digits=8, decimal_places = 2, blank=True, null = True)

    class Meta:
        verbose_name = "Detalle de Compra de Animal"
        verbose_name_plural = "Detalles de Compras de Animales"
        