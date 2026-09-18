from django.contrib import admin
from .models import PlanConsumo, DetallePlanConsumo, AsignacionPlanLote


class DetallePlanConsumoInline(admin.TabularInline):
    model = DetallePlanConsumo
    extra = 0


@admin.register(PlanConsumo)
class PlanConsumoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')
    search_fields = ('nombre',)
    inlines = [DetallePlanConsumoInline]


@admin.register(DetallePlanConsumo)
class DetallePlanConsumoAdmin(admin.ModelAdmin):
    list_display = ('plan', 'producto', 'cantidad_diaria', 'unidad')


@admin.register(AsignacionPlanLote)
class AsignacionPlanLoteAdmin(admin.ModelAdmin):
    list_display = ('lote', 'plan', 'fecha_inicio', 'fecha_fin', 'activo')
    list_filter = ('activo',)