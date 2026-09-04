from rest_framework import viewsets
from .models import RegistroAuditoria
from .serializers import RegistroAuditoriaSerializer


class RegistroAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnlyModelViewSet para que los registros de auditoría 
    solo puedan ser consultados (GET) y no modificados/borrados por la API.
    """
    queryset = RegistroAuditoria.objects.all()
    serializer_class = RegistroAuditoriaSerializer