from django.contrib import admin
from .models import (
    CategoriaProducto, UnidadMedida, Producto,
    PresentacionProducto, ConversionProducto, MovimientoInventario,
)


@admin.register(CategoriaProducto)
class CategoriaProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')
    search_fields = ('nombre',)


@admin.register(UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'tipo', 'decimales')


class PresentacionProductoInline(admin.TabularInline):
    model = PresentacionProducto
    extra = 0


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria', 'unidad_base', 'stock_actual', 'stock_minimo', 'costo_promedio', 'activo')
    list_filter = ('categoria', 'activo')
    search_fields = ('nombre',)
    inlines = [PresentacionProductoInline]


@admin.register(PresentacionProducto)
class PresentacionProductoAdmin(admin.ModelAdmin):
    list_display = ('producto', 'nombre', 'cantidad_base', 'unidad_base', 'activa')


@admin.register(ConversionProducto)
class ConversionProductoAdmin(admin.ModelAdmin):
    list_display = ('producto', 'cantidad_origen', 'unidad_origen', 'cantidad_destino', 'unidad_destino', 'activa')


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = ('fecha_hora', 'producto', 'tipo', 'cantidad', 'costo_unitario', 'costo_total', 'usuario', 'referencia_tipo')
    list_filter = ('tipo', 'referencia_tipo')
    search_fields = ('producto__nombre',)