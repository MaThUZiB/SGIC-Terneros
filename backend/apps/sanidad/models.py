from django.db import models
from apps.ganaderia.models import Animal
from apps.inventario.models import Producto


class Tratamiento(models.Model):
    animal = models.ForeignKey(Animal, on_delete=models.PROTECT, related_name='tratamientos')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    fecha = models.DateField()
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    motivo = models.CharField(max_length=200)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'tratamiento'
        verbose_name = 'Tratamiento'
        verbose_name_plural = 'Tratamientos'