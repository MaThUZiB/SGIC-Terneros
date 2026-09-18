from decimal import Decimal

from django.db.models import Sum, F, DecimalField, ExpressionWrapper

from apps.ganaderia.models import Animal, Lote
from apps.inventario.models import Producto
from apps.ventas.models import Venta, DetalleVenta
from apps.ventas.services import desglose_costo_lote


def _q(valor):
    return Decimal(valor or 0).quantize(Decimal('0.01'))


def resumen_dashboard():
    animales_activos = Animal.objects.filter(estado='ACTIVO').count()
    animales_fallecidos = Animal.objects.filter(estado='FALLECIDO').count()
    lotes_activos = Lote.objects.filter(estado='ACTIVO').count()

    valor_expresion = ExpressionWrapper(
        F('stock_actual') * F('costo_promedio'),
        output_field=DecimalField(max_digits=16, decimal_places=2),
    )
    valor_inventario = Producto.objects.aggregate(total=Sum(valor_expresion))['total'] or Decimal('0.00')

    stock_relevante = []
    alertas = []
    for producto in Producto.objects.filter(activo=True).prefetch_related('presentaciones'):
        valor = producto.stock_actual * producto.costo_promedio
        equivalencias = []
        for presentacion in producto.presentaciones.filter(activa=True):
            if presentacion.cantidad_base:
                equivalencias.append({
                    'presentacion': presentacion.nombre,
                    'cantidad': float(producto.stock_actual / presentacion.cantidad_base),
                })
        item = {
            'id': producto.id,
            'nombre': producto.nombre,
            'unidad_base': producto.unidad_base.codigo,
            'stock_actual': float(producto.stock_actual),
            'stock_minimo': float(producto.stock_minimo),
            'costo_promedio': float(producto.costo_promedio),
            'valor': float(valor),
            'equivalencias': equivalencias,
        }
        stock_relevante.append(item)
        if producto.stock_minimo and producto.stock_actual <= producto.stock_minimo:
            alertas.append(item)

    stock_relevante.sort(key=lambda x: x['valor'], reverse=True)

    ventas_total = Venta.objects.filter(estado='CONFIRMADA').aggregate(
        total=Sum('total_venta'))['total'] or Decimal('0.00')
    utilidad_total = DetalleVenta.objects.filter(venta__estado='CONFIRMADA').aggregate(
        total=Sum('utilidad'))['total'] or Decimal('0.00')

    return {
        'animales_activos': animales_activos,
        'animales_fallecidos': animales_fallecidos,
        'lotes_activos': lotes_activos,
        'valor_inventario': float(_q(valor_inventario)),
        'ventas_confirmadas_total': float(_q(ventas_total)),
        'utilidad_total': float(_q(utilidad_total)),
        'stock_relevante': stock_relevante,
        'alertas_stock': alertas,
    }


def costos_y_rentabilidad_lote(lote):
    desglose = desglose_costo_lote(lote)
    animales_considerados = lote.animales.count()

    ventas = list(DetalleVenta.objects.filter(lote=lote, venta__estado='CONFIRMADA'))
    venta_total = sum((d.ingreso for d in ventas), Decimal('0.00'))
    costo_reconocido = sum((d.costo_reconocido for d in ventas), Decimal('0.00'))
    utilidad = sum((d.utilidad for d in ventas), Decimal('0.00'))
    margen = (utilidad / venta_total * 100) if venta_total else Decimal('0.00')
    peso_total = sum(
        (d.venta.peso_total_kg for d in ventas if d.venta.peso_total_kg), Decimal('0.00'))

    costo_total = desglose['costo_total']
    return {
        'lote_id': lote.id,
        'lote_codigo': lote.codigo,
        'estado': lote.estado,
        'animales_considerados': animales_considerados,
        'animales_activos': lote.cantidad_actual,
        'costo': {k: float(v) for k, v in desglose.items()},
        'costo_promedio_animal': float(
            (costo_total / animales_considerados).quantize(Decimal('0.01'))
            if animales_considerados else Decimal('0.00')),
        'venta_total': float(_q(venta_total)),
        'costo_reconocido': float(_q(costo_reconocido)),
        'utilidad': float(_q(utilidad)),
        'margen_porcentaje': float(_q(margen)),
        'peso_vendido_kg': float(_q(peso_total)),
        'utilidad_promedio_animal': float(
            (utilidad / animales_considerados).quantize(Decimal('0.01'))
            if animales_considerados else Decimal('0.00')),
    }