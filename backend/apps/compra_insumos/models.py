from django.db import models
from apps.compra_animales.models import Proveedor
from apps.inventario.models import Producto, PresentacionProducto


class CompraInsumo(models.Model):
    ESTADO_CHOICES = [
        ('BORRADOR', 'Borrador'),
        ('CONFIRMADA', 'Confirmada'),
        ('ANULADA', 'Anulada'),
    ]

    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT)
    fecha = models.DateField()
    numero_documento = models.CharField(max_length=50, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='BORRADOR')
    total = models.DecimalField(max_digits=12, decimal_places=2)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'compra_insumo'
        verbose_name = 'Compra de Insumo'
        verbose_name_plural = 'Compras de Insumos'


class DetalleCompraInsumo(models.Model):
    compra = models.ForeignKey(CompraInsumo, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    presentacion = models.ForeignKey(PresentacionProducto, on_delete=models.PROTECT, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    cantidad_base = models.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'detalle_compra_insumo'
        verbose_name = 'Detalle de Compra de Insumo'
        verbose_name_plural = 'Detalles de Compra de Insumos'