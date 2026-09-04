from django.db import models
from django.conf import settings
from apps.ganaderia.models import Lote
from apps.inventario.models import Producto, UnidadMedida


class Consumo(models.Model):
    ORIGEN_CHOICES = [
        ('PLAN', 'Plan'),
        ('REAL', 'Real'),
        ('AJUSTE', 'Ajuste'),
    ]

    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, null=True, blank=True, related_name='consumos')
    fecha = models.DateField()
    origen = models.CharField(max_length=20, choices=ORIGEN_CHOICES)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'consumo'
        verbose_name = 'Consumo'
        verbose_name_plural = 'Consumos'


class DetalleConsumo(models.Model):
    consumo = models.ForeignKey(Consumo, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    unidad = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)  # PMP aplicado
    costo_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'detalle_consumo'
        verbose_name = 'Detalle de Consumo'
        verbose_name_plural = 'Detalles de Consumos'