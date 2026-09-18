from rest_framework import viewsets, status, decorators
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed
from config.permissions import EsAdministrador
from .models import CompraInsumo, DetalleCompraInsumo
from .serializers import CompraInsumoSerializer, DetalleCompraInsumoSerializer, CompraInsumoCreateSerializer
from .services import crear_compra, confirmar_compra, anular_compra


class CompraInsumoViewSet(viewsets.ModelViewSet):
    queryset = CompraInsumo.objects.select_related('proveedor').prefetch_related('detalles__producto').all()
    serializer_class = CompraInsumoSerializer

    def create(self, request, *args, **kwargs):
        serializer = CompraInsumoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        compra = crear_compra(serializer.validated_data, request.user)
        compra.refresh_from_db()
        return Response(self.get_serializer(compra).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    @decorators.action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        compra = self.get_object()
        confirmar_compra(compra, request.user)
        compra.refresh_from_db()
        return Response(self.get_serializer(compra).data)

    @decorators.action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        compra = self.get_object()
        anular_compra(compra, request.user)
        compra.refresh_from_db()
        return Response(self.get_serializer(compra).data)


class DetalleCompraInsumoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleCompraInsumo.objects.select_related('producto', 'presentacion', 'compra').all()
    serializer_class = DetalleCompraInsumoSerializer