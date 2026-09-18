from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import get_object_or_404
from apps.ganaderia.models import Lote
from .services import resumen_dashboard, costos_y_rentabilidad_lote


class ResumenView(APIView):
    """Indicadores principales del dashboard (RF-27)."""

    def get(self, request):
        return Response(resumen_dashboard())


class CostosLoteView(APIView):
    """Costos acumulados y rentabilidad de un lote (RF-25, RF-26)."""

    def get(self, request, lote_id):
        lote = get_object_or_404(Lote, pk=lote_id)
        return Response(costos_y_rentabilidad_lote(lote))