from django.db import models

# Create your models here.
class Raza(models.Model):
    nombre = models.CharField(max_length=80, unique=True)

    class Meta:
        verbose_name = "Raza"
        verbose_name_plural = "Razas"

    def __str__(self):
        return self.nombre

class Lote(models.Model):
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('CERRADO', 'Cerrado'),
    ]
    codigo = models.CharField(max_length=30, unique=True)
    lote_origen = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name = 'lotes_derivados'
    )
    fecha_ingreso = models.DateField()
    cantidad_original = models.IntegerField()
    cantidad_actual =models.IntegerField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO')
    observaciones = models.TextField(blank=True, null=True)
    creado_el = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Lote"
        verbose_name_plural = "Lotes"

    def __str__(self):
        return f"{self.codigo} (Activos: {self.cantidad_actual}/{self.cantidad_original})"

class Animales(models.Model):
    SEXO_CHOICES = [
        ('M', 'Macho'),
        ('H', 'Hembra'),
    ]
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('VENDIDO','Vendido'),
        ('FALLECIDO','Fallecido'),
    ]

    diio = models.CharField(max_length=30, unique=True, verbose_name="DIIO")
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name= 'animales')
    raza = models.ForeignKey(Raza, on_delete=models.PROTECT, related_name= 'animales')
    sexo = models.CharField(max_length=10, choices=SEXO_CHOICES)
    fecha_nacimiento = DateField(null=True, blank=True)
    edad_aproximada_dias = models.IntegerField()
    fecha_adquisicion = models.DateField()
    precio_adquisicion = models.DecimalField(max_digits=12, decimal_places=2)
    precio_ingreso_kg = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO')
    observaciones = models.TextField(blank=True, null=True)    

    class Meta:
        verbose_name = "Animal"
        verbose_name_plural = "Animales"

    def __str__(self):
        return f"DIIO: {self.diio}"

class PesoAnimal(models.Model):
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='pesajes')
    fecha = models.DateField()
    peso_kg = models.DecimalField(max_digits=8, decimal_places=2)
    observaciones = TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Pesaje de Animal"
        verbose_name_plural = "Pesajes de Animales"

    def __str__(self):
        return f"{self.animal.diio} - {self.peso_kg} kg ({self.fecha})"