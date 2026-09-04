from django.db import models
from apps.ganaderia.models import Lote


class CategoriaGasto(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'categoria_gasto'
        verbose_name = 'Categoría de Gasto'
        verbose_name_plural = 'Categorías de Gastos'

    def __str__(self):
        return self.nombre


class Gasto(models.Model):
    categoria = models.ForeignKey(CategoriaGasto, on_delete=models.PROTECT, related_name='gastos')
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, null=True, blank=True, related_name='gastos')
    fecha = models.DateField()
    nombre = models.CharField(max_length=120)
    detalle = models.TextField(blank=True, null=True)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'gasto'
        verbose_name = 'Gasto'
        verbose_name_plural = 'Gastos'