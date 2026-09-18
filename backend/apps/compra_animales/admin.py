from django.contrib import admin
from .models import Proveedor, CompraAnimal, DetalleCompraAnimal


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'rut', 'telefono', 'activo')
    search_fields = ('nombre', 'rut')


class DetalleCompraAnimalInline(admin.TabularInline):
    model = DetalleCompraAnimal
    extra = 0


@admin.register(CompraAnimal)
class CompraAnimalAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha', 'proveedor', 'total')
    list_filter = ('fecha',)
    inlines = [DetalleCompraAnimalInline]


@admin.register(DetalleCompraAnimal)
class DetalleCompraAnimalAdmin(admin.ModelAdmin):
    list_display = ('id', 'compra', 'animal', 'precio_adquisicion', 'peso_compra')
    search_fields = ('animal__diio',)