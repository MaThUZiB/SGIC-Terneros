from django.contrib import admin
from .models import RegistroAuditoria


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display = ('fecha_hora', 'usuario', 'accion', 'modelo', 'objeto_id')
    list_filter = ('accion', 'modelo')
    readonly_fields = ('usuario', 'fecha_hora', 'accion', 'modelo', 'objeto_id', 'datos_anteriores', 'datos_nuevos')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False