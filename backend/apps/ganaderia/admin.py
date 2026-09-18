from django.contrib import admin
from .models import Raza, Lote, Animal, PesoAnimal


@admin.register(Raza)
class RazaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre')
    search_fields = ('nombre',)


@admin.register(Lote)
class LoteAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'fecha_ingreso', 'cantidad_original', 'cantidad_actual', 'estado', 'lote_origen')
    list_filter = ('estado',)
    search_fields = ('codigo',)


@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ('diio', 'lote', 'raza', 'sexo', 'estado', 'fecha_adquisicion', 'precio_adquisicion')
    list_filter = ('estado', 'raza', 'sexo')
    search_fields = ('diio',)


@admin.register(PesoAnimal)
class PesoAnimalAdmin(admin.ModelAdmin):
    list_display = ('animal', 'fecha', 'peso_kg')
    search_fields = ('animal__diio',)