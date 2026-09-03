from django.db import models

# Create your models here.
class Lote(models.Model):
    ESTADO_LOTE = [
        ('ACTIVO', 'Activo'),
        ('CERRADO', 'Cerrado'),
    ]

    codigo = models.CharField(max_length=30, unique=True)
    lote_origen = models.ForeignKey('self', on_delete=models.SET_NULL, blank=True, null=True, related_name='lotes_derivados')
    fecha_ingreso = models.DateField()
    cantidad_original = models.IntegerField()
    cantidad_actual = models.IntegerField()
    estado = models.CharField(max_length=20, choices= ESTADOS_LOTE, default='ACTIVO')
    observaciones = models.textField(blank=True, null=True)
    creado_el = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Lote"
        verbose_name_plural = "Lotes"

    def __str__(self):
        return f"Lote {self.codigo} ({self.cantidad_actual} activos)"