from rest_framework import viewsets, status, decorators
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from config.permissions import EsAdministrador, EsAdministradorOLectura
from .models import (
    CategoriaProducto, UnidadMedida, Producto,
    PresentacionProducto, ConversionProducto, MovimientoInventario,
)
from .serializers import (
    CategoriaProductoSerializer, UnidadMedidaSerializer, ProductoSerializer,
    PresentacionProductoSerializer, ConversionProductoSerializer, MovimientoInventarioSerializer,
)
from .services import InventarioService


class CategoriaProductoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaProducto.objects.all()
    serializer_class = CategoriaProductoSerializer
    permission_classes = [EsAdministradorOLectura]


class UnidadMedidaViewSet(viewsets.ModelViewSet):
    queryset = UnidadMedida.objects.all()
    serializer_class = UnidadMedidaSerializer
    permission_classes = [EsAdministradorOLectura]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.select_related('categoria', 'unidad_base').prefetch_related('presentaciones').all()
    serializer_class = ProductoSerializer
    permission_classes = [EsAdministradorOLectura]

    def get_queryset(self):
        qs = super().get_queryset()
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria_id=categoria)
        return qs


class PresentacionProductoViewSet(viewsets.ModelViewSet):
    queryset = PresentacionProducto.objects.select_related('producto', 'unidad_base').all()
    serializer_class = PresentacionProductoSerializer
    permission_classes = [EsAdministradorOLectura]


class ConversionProductoViewSet(viewsets.ModelViewSet):
    queryset = ConversionProducto.objects.all()
    serializer_class = ConversionProductoSerializer
    permission_classes = [EsAdministradorOLectura]


class MovimientoInventarioViewSet(viewsets.ReadOnlyModelViewSet):
    """Los movimientos son de solo lectura: toda variación debe pasar por InventarioService."""
    queryset = MovimientoInventario.objects.select_related('producto', 'usuario').all()
    serializer_class = MovimientoInventarioSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        producto = self.request.query_params.get('producto')
        tipo = self.request.query_params.get('tipo')
        if producto:
            qs = qs.filter(producto_id=producto)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    @decorators.action(detail=False, methods=['post'], permission_classes=[EsAdministrador])
    def ajuste(self, request):
        producto = request.data.get('producto')
        cantidad = request.data.get('cantidad')
        if not producto or cantidad in (None, ''):
            raise ValidationError({'detalle': 'Debe indicar producto y cantidad.'})
        movimiento = InventarioService.ajuste(
            producto_id=producto,
            cantidad=cantidad,
            usuario=request.user,
            motivo=request.data.get('motivo', 'Ajuste manual'),
            observaciones=request.data.get('observaciones'),
        )
        return Response(MovimientoInventarioSerializer(movimiento).data, status=status.HTTP_201_CREATED)