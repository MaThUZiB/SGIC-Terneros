from django.db import models

# Create your models here.
from apps.lotes.models import Lote

class Raza(models.Model):
    nombre = models.CharField(max_length=80, unique=True)

    class Meta:
        verbose_name = "Raza"
        verbose_name_plural = "Razas"

    def __str__(self):
        return self.nombre

class Animal(models.Model):
    ESTADOS_ANIMAL = [
        ('ACTIVO', 'Activo'),
        ('VENDIDO', 'Vendido'),
        ('FALLECIDO', 'Fallecido'),
    ]

    SEXOS = [
        ('M', 'Macho'),
        ('H', 'Hembra'),
    ]

    diio = models.CharField(max_length=30, unique=True)
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='animales')
    raza = models.ForeignKey(Raza, on_delete=models.PROTECT, related_name='animales')
    sexo = models.CharField(max_length=30, choices=SEXOS)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    edad_aproximada_dias = models.IntegerField()
    fecha_adquisicion = models.DateField()
    precio_adquisicion = models.DecimalField(max_digits=12, decimal_places=2)
    peso_ingreso_kg = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADOS_ANIMAL, default='ACTIVO')
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Animal"
        verbose_name_plural = "Animales"

    def __str__(self):
        return f"DIIO: {self.codigo} - Lote: {self.lote.codigo}"

class PesoAnimal(models.Model):
    animal = models.Foreign(Animal, on_delete=models.CASCADE, related_name='pesajes')
    fecha = models.DateField()
    peso_kg = models.DecimalField(max_digits=8, decimal_places=2)
    observaciones = models.textField(blank=True, null=True)

    class Meta:
        verbose_name = "Peso de Animal"
        verbose_name_plural = "Pesaje de Animales"

    def __str__(self):
        return f"{self.animal.diio} - {self.peso_kg} kg {self.fecha}"