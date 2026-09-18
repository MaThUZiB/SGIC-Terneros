from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, MethodNotAllowed
from config.permissions import EsAdministradorOLectura
from .models import Proveedor, CompraAnimal, DetalleCompraAnimal
from .serializers import (
    ProveedorSerializer,
    CompraAnimalSerializer,
    DetalleCompraAnimalSerializer,
    CompraAnimalCreateSerializer,
)
from .services import registrar_compra


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [EsAdministradorOLectura]


class CompraAnimalViewSet(viewsets.ModelViewSet):
    queryset = CompraAnimal.objects.select_related('proveedor').all()
    serializer_class = CompraAnimalSerializer

    def create(self, request, *args, **kwargs):
        serializer = CompraAnimalCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        compra = registrar_compra(serializer.validated_data, request.user)
        compra.refresh_from_db()
        output = self.get_serializer(compra).data
        return Response(output, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)


class DetalleCompraAnimalViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleCompraAnimal.objects.select_related('animal', 'compra').all()
    serializer_class = DetalleCompraAnimalSerializer