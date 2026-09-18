from django.contrib import admin
from .models import CompraInsumo, DetalleCompraInsumo


class DetalleCompraInsumoInline(admin.TabularInline):
    model = DetalleCompraInsumo
    extra = 0


@admin.register(CompraInsumo)
class CompraInsumoAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha', 'proveedor', 'estado', 'total', 'numero_documento')
    list_filter = ('estado',)
    inlines = [DetalleCompraInsumoInline]


@admin.register(DetalleCompraInsumo)
class DetalleCompraInsumoAdmin(admin.ModelAdmin):
    list_display = ('compra', 'producto', 'presentacion', 'cantidad', 'cantidad_base', 'precio_unitario', 'subtotal')