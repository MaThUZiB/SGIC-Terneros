from django.db import models


class Raza(models.Model):
    nombre = models.CharField(max_length=80, unique=True)

    class Meta:
        db_table = 'raza'
        verbose_name = 'Raza'
        verbose_name_plural = 'Razas'

    def __str__(self):
        return self.nombre


class Lote(models.Model):
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('CERRADO', 'Cerrado'),
    ]

    codigo = models.CharField(max_length=30, unique=True)
    lote_origen = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='lotes_derivados')
    fecha_ingreso = models.DateField()
    cantidad_original = models.IntegerField()
    cantidad_actual = models.IntegerField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO')
    observaciones = models.TextField(blank=True, null=True)
    creado_el = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lote'
        verbose_name = 'Lote'
        verbose_name_plural = 'Lotes'

    def __str__(self):
        return self.codigo


class Animal(models.Model):
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('VENDIDO', 'Vendido'),
        ('FALLECIDO', 'Fallecido'),
    ]

    diio = models.CharField(max_length=30, unique=True)
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='animales')
    raza = models.ForeignKey(Raza, on_delete=models.PROTECT)
    sexo = models.CharField(max_length=10)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    edad_aproximada_dias = models.IntegerField()
    fecha_adquisicion = models.DateField()
    precio_adquisicion = models.DecimalField(max_digits=12, decimal_places=2)
    peso_ingreso_kg = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO')
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'animal'
        verbose_name = 'Animal'
        verbose_name_plural = 'Animales'

    def __str__(self):
        return f"DIIO: {self.diio}"


class PesoAnimal(models.Model):
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='pesajes')
    fecha = models.DateField()
    peso_kg = models.DecimalField(max_digits=8, decimal_places=2)
    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'peso_animal'
        verbose_name = 'Peso de Animal'
        verbose_name_plural = 'Pesos de Animales'