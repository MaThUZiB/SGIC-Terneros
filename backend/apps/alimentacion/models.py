from django.db import models
from apps.inventario.models import Producto, UnidadMedida
from apps.ganaderia.models import Lote


class PlanConsumo(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'plan_consumo'
        verbose_name = 'Plan de Consumo'
        verbose_name_plural = 'Planes de Consumo'

    def __str__(self):
        return self.nombre


class DetallePlanConsumo(models.Model):
    plan = models.ForeignKey(PlanConsumo, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad_diaria = models.DecimalField(max_digits=12, decimal_places=3)
    unidad = models.ForeignKey(UnidadMedida, on_delete=models.PROTECT)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'detalle_plan_consumo'
        verbose_name = 'Detalle de Plan de Consumo'
        verbose_name_plural = 'Detalles de Planes de Consumo'


class AsignacionPlanLote(models.Model):
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='asignaciones_plan')
    plan = models.ForeignKey(PlanConsumo, on_delete=models.PROTECT)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'asignacion_plan_lote'
        verbose_name = 'Asignación de Plan a Lote'
        verbose_name_plural = 'Asignaciones de Planes a Lotes'