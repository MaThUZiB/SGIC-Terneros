from django.contrib import admin
from .models import Consumo, DetalleConsumo


class DetalleConsumoInline(admin.TabularInline):
    model = DetalleConsumo
    extra = 0


@admin.register(Consumo)
class ConsumoAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha', 'lote', 'origen', 'usuario')
    list_filter = ('origen',)
    inlines = [DetalleConsumoInline]


@admin.register(DetalleConsumo)
class DetalleConsumoAdmin(admin.ModelAdmin):
    list_display = ('consumo', 'producto', 'cantidad', 'unidad', 'costo_unitario', 'costo_total')