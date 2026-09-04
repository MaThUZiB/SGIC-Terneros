from rest_framework import viewsets
from .models import CategoriaGasto, Gasto
from .serializers import CategoriaGastoSerializer, GastoSerializer


class CategoriaGastoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaGasto.objects.all()
    serializer_class = CategoriaGastoSerializer


class GastoViewSet(viewsets.ModelViewSet):
    queryset = Gasto.objects.all()
    serializer_class = GastoSerializer