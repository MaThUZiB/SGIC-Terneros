from django.contrib import admin
from .models import Venta, DetalleVenta


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha', 'comprador', 'estado', 'total_venta', 'peso_total_kg', 'precio_kg')
    list_filter = ('estado', 'fecha')
    inlines = [DetalleVentaInline]


@admin.register(DetalleVenta)
class DetalleVentaAdmin(admin.ModelAdmin):
    list_display = ('venta', 'lote', 'cantidad_animales', 'ingreso', 'costo_reconocido', 'utilidad')