from django.db import transaction
from .models import RegistroAuditoria


@transaction.atomic
def registrar(usuario, accion, modelo, objeto_id, datos_anteriores=None, datos_nuevos=None):
    """Guarda un registro de auditoría. Los datos deben ser serializables a JSON."""
    return RegistroAuditoria.objects.create(
        usuario=usuario if (usuario and usuario.is_authenticated) else None,
        accion=accion[:30],
        modelo=modelo[:80],
        objeto_id=objeto_id,
        datos_anteriores=datos_anteriores,
        datos_nuevos=datos_nuevos,
    )