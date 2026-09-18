from rest_framework import viewsets
from config.permissions import EsAdministrador
from .models import CategoriaGasto, Gasto
from .serializers import CategoriaGastoSerializer, GastoSerializer


class CategoriaGastoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaGasto.objects.all()
    serializer_class = CategoriaGastoSerializer
    permission_classes = [EsAdministrador]


class GastoViewSet(viewsets.ModelViewSet):
    queryset = Gasto.objects.select_related('categoria', 'lote').all()
    serializer_class = GastoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        lote = self.request.query_params.get('lote')
        general = self.request.query_params.get('general')
        if lote:
            qs = qs.filter(lote_id=lote)
        if general == 'true':
            qs = qs.filter(lote__isnull=True)
        if general == 'false':
            qs = qs.filter(lote__isnull=False)
        return qs