from django.contrib import admin
from .models import Tratamiento


@admin.register(Tratamiento)
class TratamientoAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha', 'animal', 'producto', 'cantidad', 'costo_total', 'motivo')
    list_filter = ('fecha',)
    search_fields = ('animal__diio', 'motivo')