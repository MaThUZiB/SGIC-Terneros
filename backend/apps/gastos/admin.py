from django.contrib import admin
from .models import CategoriaGasto, Gasto


@admin.register(CategoriaGasto)
class CategoriaGastoAdmin(admin.ModelAdmin):
    list_display = ('nombre',)
    search_fields = ('nombre',)


@admin.register(Gasto)
class GastoAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'nombre', 'categoria', 'lote', 'monto')
    list_filter = ('categoria', 'fecha')
    search_fields = ('nombre', 'detalle')