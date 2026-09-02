from django.contrib import admin
from .models import CategoriaProducto, UnidadMedida, Producto
# Register your models here.

@admin.register(CategoriaProducto)
class CategoriaProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')
    search_fields = ('nombre',)

@admin.register(UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'codigo', 'tipo', 'decimales')
    search_fields = ('nombre', 'codigo')

@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria', 'unidad_base', 'stock_actual', 'stock_minimo', 'costo_promedio', 'activo')
    list_filter = ('categoria', 'activo')
    search_fields = ('nombre',)