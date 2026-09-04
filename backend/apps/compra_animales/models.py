from django.db import models
from apps.ganaderia.models import Animal


class Proveedor(models.Model):
    nombre = models.CharField(max_length=150)
    rut = models.CharField(max_length=20, blank=True, null=True)
    telefono = models.CharField(max_length=30, blank=True, null=True)
    email = models.CharField(max_length=120, blank=True, null=True)
    direccion = models.CharField(max_length=200, blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'proveedor'
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'

    def __str__(self):
        return self.nombre


class CompraAnimal(models.Model):
    fecha = models.DateField()
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'compra_animal'
        verbose_name = 'Compra de Animales'
        verbose_name_plural = 'Compras de Animales'


class DetalleCompraAnimal(models.Model):
    compra = models.ForeignKey(CompraAnimal, on_delete=models.CASCADE, related_name='detalles')
    animal = models.OneToOneField(Animal, on_delete=models.PROTECT)
    precio_adquisicion = models.DecimalField(max_digits=12, decimal_places=2)
    peso_compra = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'detalle_compra_animal'
        verbose_name = 'Detalle de Compra de Animal'
        verbose_name_plural = 'Detalles de Compra de Animales'