from django.db import models
from apps.ganaderia.models import Lote


class Venta(models.Model):
    ESTADO_CHOICES = [
        ('BORRADOR', 'Borrador'),
        ('CONFIRMADA', 'Confirmada'),
        ('ANULADA', 'Anulada'),
    ]

    fecha = models.DateField()
    comprador = models.CharField(max_length=150, null=True, blank=True)
    peso_total_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    precio_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_venta = models.DecimalField(max_digits=12, decimal_places=2)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='BORRADOR')
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'venta'
        verbose_name = 'Venta'
        verbose_name_plural = 'Ventas'


class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='ventas_detalle')
    cantidad_animales = models.IntegerField()
    costo_reconocido = models.DecimalField(max_digits=12, decimal_places=2)
    utilidad = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'detalle_venta'
        verbose_name = 'Detalle de Venta'
        verbose_name_plural = 'Detalles de Ventas'