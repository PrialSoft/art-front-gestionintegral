// components/poliza/poliza.tsx
"use client"; // Marca el componente como un Componente de Cliente

import React, { useState, useEffect, useRef } from "react";
import styles from "./poliza.module.css";
import { useAuth } from "@/data/AuthContext";
import { TextField, Box } from "@mui/material";
import Formato from "@/utils/Formato";
import SrtAPI from "@/data/srtAPI";
import ArtAPI from '@/data/artAPI';
import AuthAPI from '@/data/authAPI';
import type { ComercializadorById, VComercializadorRow } from '@/app/inicio/comercializador/administracionComercializadores/types/administracionUsuarios';
import CustomButton from "@/utils/ui/button/CustomButton";
import { BsDownload } from "react-icons/bs";
import { saveAs } from "file-saver";
import { getSession } from "next-auth/react";
import { useEmpresasStore } from "@/data/empresasStore";
import { Empresa } from "@/data/authAPI";
import CustomSelectSearch from "@/utils/ui/form/CustomSelectSearch";
import { useSearchParams } from "next/navigation";

const { useGetPoliza } = SrtAPI;

const Poliza = () => {
  const { empresas, isLoading: isLoadingEmpresas } = useEmpresasStore();
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<Empresa | null>(null);
  const seleccionAutomaticaRef = useRef(false);
  const [bloquearBusquedaPorCuit, setBloquearBusquedaPorCuit] = useState(false);

  const searchParams = useSearchParams();
  const cuitQuery = searchParams.get("cuit") ?? searchParams.get("cuil");
  const cuitForzado = cuitQuery ? Number(String(cuitQuery).replace(/\D/g, "")) : NaN;
  
  // Obtener la póliza priorizando el CUIT forzado por query param (viene desde comercializador)
  const { data: polizaRawData, isLoading: isPersonalLoading } = useGetPoliza(
    Number.isFinite(cuitForzado) && cuitForzado > 0 ? { CUIT: cuitForzado } : empresaSeleccionada ? { CUIT: empresaSeleccionada.cuit }: {}
  );

  // Seleccionar automáticamente si solo hay una empresa
  useEffect(() => {
    if (Number.isFinite(cuitForzado) && cuitForzado > 0) return;
    if (!isLoadingEmpresas) {
      if (empresas.length === 1) {
        // Si hay exactamente 1 empresa, seleccionarla automáticamente
        setEmpresaSeleccionada(empresas[0]);
        seleccionAutomaticaRef.current = true;
      } else if (empresas.length !== 1 && seleccionAutomaticaRef.current) {
        // Si hay más de 1 empresa o 0 empresas, y la selección fue automática,
        // limpiar la selección
        setEmpresaSeleccionada(null);
        seleccionAutomaticaRef.current = false;
      }
    }
  }, [empresas.length, isLoadingEmpresas]);

  // Si viene CUIT por query param, forzar selección por CUIT y bloquear el selector
  useEffect(() => {
    if (isLoadingEmpresas) return;

    const hasCuitForzado = Number.isFinite(cuitForzado) && cuitForzado > 0;
    setBloquearBusquedaPorCuit(hasCuitForzado);
    if (!hasCuitForzado) return;

    const match = empresas.find((e) => {
      const digits = Number(String((e as any)?.cuit ?? "").replace(/\D/g, ""));
      return Number.isFinite(digits) && digits === cuitForzado;
    });

    if (match) {
      setEmpresaSeleccionada(match);
      seleccionAutomaticaRef.current = true;
    }
  }, [cuitForzado, empresas, isLoadingEmpresas]);

  // Si está bloqueado por CUIT y no hay match en el store, igual mostrar la Razón Social en el combo
  useEffect(() => {
    if (!bloquearBusquedaPorCuit) return;
    if (empresaSeleccionada) return;
    const razonSocial = polizaRawData?.empleadorDenominacion;
    if (!razonSocial) return;
    setEmpresaSeleccionada({ razonSocial: String(razonSocial) } as any);
  }, [bloquearBusquedaPorCuit, empresaSeleccionada, polizaRawData?.empleadorDenominacion]);

  const handleDownloadPDF = async () => {
    if (!polizaRawData?.archivo) {
      console.error("No hay archivo disponible para descargar");
      return;
    }

    try {
      const archivo = polizaRawData.archivo;
      
      // Verificar si es una URL o base64
      if (archivo.startsWith("http://") || archivo.startsWith("https://")) {
        // Es una URL, hacer fetch con autenticación si es necesario
        const session = await getSession();
        const headers: HeadersInit = {};
        
        if (session?.accessToken) {
          headers.Authorization = `Bearer ${session.accessToken}`;
        }
        
        const response = await fetch(archivo, { headers });
        if (!response.ok) {
          throw new Error("Error al descargar el archivo");
        }
        const blob = await response.blob();
        saveAs(blob, `poliza_${polizaRawData?.numero || "poliza"}.pdf`);
      } else if (archivo.startsWith("data:")) {
        // Es un data URL (base64 con prefijo)
        const response = await fetch(archivo);
        const blob = await response.blob();
        saveAs(blob, `poliza_${polizaRawData?.numero || "poliza"}.pdf`);
      } else {
        // Asumir que es base64 sin prefijo
        const byteCharacters = atob(archivo);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        saveAs(blob, `poliza_${polizaRawData?.numero || "poliza"}.pdf`);
      }
    } catch (error) {
      console.error("Error al descargar el PDF:", error);
    }
  };

  const handleEmpresaChange = (
    _event: React.SyntheticEvent,
    newValue: Empresa | null
  ) => {
    if (bloquearBusquedaPorCuit) return;
    setEmpresaSeleccionada(newValue);
    // Marcar que la selección fue manual
    seleccionAutomaticaRef.current = false;
  };

  const getEmpresaLabel = (empresa: Empresa | null): string => {
    if (!empresa) return "";
    if (bloquearBusquedaPorCuit) return String((empresa as any)?.razonSocial ?? "");
    const cuitFormateado = Formato.CUIP((empresa as any)?.cuit);
    return `${(empresa as any)?.razonSocial ?? ""} - ${cuitFormateado}`;
  };

  const srtIdRawGlobal = polizaRawData?.srtComercializadorInterno ?? 0;
  const srtIdGlobal = Number(String(srtIdRawGlobal ?? 0).replace(/\D/g, ""));
  const { data: comercializadorByIdData } = ArtAPI.useGetComercializadorById(
    Number.isFinite(srtIdGlobal) && srtIdGlobal > 0 ? ({ id: srtIdGlobal } as unknown as ComercializadorById) : undefined
  );

  // Cargar parámetros de entidad (entidadId = 0) para Datos de la Aseguradora
  const { data: parametrosEntidadData } = AuthAPI.useGetParametrosEntidadURL({
    entidadId: 0,
    PageIndex: 1,
    PageSize: 100,
  });
  const parametrosMap: Record<string, string> = (parametrosEntidadData ?? []).reduce(
    (acc: Record<string, string>, p: any) => {
      if (p?.parametroNombre) acc[p.parametroNombre] = String(p?.valor ?? "");
      return acc;
    },
    {}
  );

  return (
    <div>
      {/* Combo de selección de empresa en la parte superior izquierda */}
      <Box className={styles.empresaSelectorContainer}>
        <CustomSelectSearch<Empresa>
          options={empresas}
          getOptionLabel={getEmpresaLabel}
          value={empresaSeleccionada}
          onChange={handleEmpresaChange}
          label="Seleccionar Empresa"
          placeholder="Buscar empresa..."
          loading={isLoadingEmpresas}
          loadingText="Cargando empresas..."
          noOptionsText={
            isLoadingEmpresas
              ? "Cargando..."
              : empresas.length === 0
              ? "No hay empresas disponibles"
              : "No se encontraron empresas"
          }
          disabled={isLoadingEmpresas || bloquearBusquedaPorCuit}
        />
      </Box>

      {/* Botón de descarga PDF */}
      <div style={{ marginBottom: "20px" }}>
        <CustomButton
          onClick={handleDownloadPDF}
          disabled={!polizaRawData?.archivo || isPersonalLoading}
          icon={<BsDownload size={20} />}
          variant="contained"
          color="primary"
        >
          Descargar Póliza PDF
        </CustomButton>
      </div>
      {/* Sección de Razón Social */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.headerTitle}>Razón Social</h2>
        <p className={styles.headerData}>
          {polizaRawData?.empleadorDenominacion ?? "---"}
        </p>
      </div>

      {/* Sección de Datos de la Aseguradora */}
      <h3 className={styles.sectionTitle}>Datos de la Aseguradora</h3>
      <div className={styles.dataGrid}>
        <TextField
          label="CUIT:"
          name="CUIT"
          value={parametrosMap['ART_CUIT'] ?? ""}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Domicilio:"
          name="Domicilio"
          value={parametrosMap['ART_Domicilio'] ?? ""}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Teléfono:"
          name="Telefono"
          value={parametrosMap['ART_Telefono'] ?? ""}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Email:"
          name="Email"
          value={parametrosMap['ART_Email'] ?? ""}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Reclamos y Consultas:"
          name="reclamos"
          value={parametrosMap['ART_Reclamos y Consulta'] ?? ""}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Denominación:"
          name="Denominacion"
          value={parametrosMap['ART_Denominacion'] ?? ""}
          fullWidth
          variant="standard"
        />
        <TextField
          label="FAX:"
          name="FAX"
          value={parametrosMap['ART_Fax'] ?? ""}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Página web:"
          name="web"
          value={parametrosMap['ART_Pagina web'] ?? ""}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Denuncias y Accidentes:"
          name="denuncias"
          value={parametrosMap['ART_Denuncia y Accidente'] ?? ""}
          fullWidth
          variant="standard"
        />
      </div>

      {/* Sección de Canal Comercial */}
      <h3 className={styles.sectionTitle}>Canal Comercial</h3>
      {
        (() => {
          const comercializador = (comercializadorByIdData as VComercializadorRow) ?? null;

          if (Number.isFinite(srtIdGlobal) && srtIdGlobal > 0) {
            return (
              <div className={styles.dataGrid}>
                <TextField
                  label="CUIT/CUIL:"
                  name="cuitcuil"
                  value={String(comercializador?.cuil ?? "-----------")}
                  fullWidth
                  variant="standard"
                />
                <TextField
                  label="Matricula:"
                  name="Matricula"
                  value={String(comercializador?.matricula ?? "-----------")}
                  fullWidth
                  variant="standard"
                />
                <TextField
                  label="Apellido y Nombre/Denominación:"
                  name="apellidoynombre"
                  value={String(comercializador?.referenteRazonSocial ?? "-----------")}
                  fullWidth
                  variant="standard"
                />
              </div>
            );
          }

          return (
            <div className={styles.dataGrid}>
              <TextField
                label="CUIT/CUIL:"
                name="cuitcuil"
                value="-----------"
                fullWidth
                variant="standard"
              />
              <TextField
                label="Matricula:"
                name="Matricula"
                value="-----------"
                fullWidth
                variant="standard"
              />
              <TextField
                label="Apellido y Nombre/Denominación:"
                name="apellidoynombre"
                value="-----------"
                fullWidth
                variant="standard"
              />
            </div>
          );
        })()
      }

      {/* Sección de Datos del Empleador */}
      <h3 className={styles.sectionTitle}>Datos del Empleador</h3>
      <div className={styles.dataGrid}>
        <TextField
          label="Nº Póliza Digital:"
          name="NroPoliza"
          value={polizaRawData?.numero || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Nº CUIT:"
          name="CUITEmpleador"
          value={Formato.CUIP(polizaRawData?.cuit) || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Vigencia Desde:"
          name="desde"
          value={Formato.Fecha(polizaRawData?.vigenciaDesde) || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Vigencia Hasta:"
          name="hasta"
          value={Formato.Fecha(polizaRawData?.vigenciaHasta) || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Localidad:"
          name="Localidad"
          value={`${
            polizaRawData?.empleadorDomicilioLocalidadDescripcion || "---"
          } - CP:${polizaRawData?.empleadorDomicilioCP || "---"}`}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Provincia:"
          name="Provincia"
          value={
            polizaRawData?.empleadorDomicilioProvinciaDescripcion || "---"
          }
          fullWidth
          variant="standard"
        />
        <TextField
          label="Calle:"
          name="Calle"
          value={`${polizaRawData?.empleadorDomicilioCalle || "---"} ${
            polizaRawData?.empleadorDomicilioAltura || "---"
          } ${polizaRawData?.empleadorDomicilioPiso || ""} ${
            polizaRawData?.empleadorDomicilioDepto || ""
          }`}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Email:"
          name="EmailEmpleador"
          value={polizaRawData?.empleadorEmail || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Telefono:"
          name="TelefonoEmpleador"
          value={polizaRawData?.empleadorTelefono || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Movil:"
          name="MovilEmpleador"
          value={polizaRawData?.empleadorMovil || "---"}
          fullWidth
          variant="standard"
        />
      </div>

      {/* Sección de Condiciones Comerciales */}
      <h3 className={styles.sectionTitle}>Condiciones Comerciales</h3>
      <div className={styles.dataGrid}>
        <TextField
          label="CIIU:"
          name="CIIU"
          value={polizaRawData?.ciiu
            ? `${polizaRawData.ciiu} - ${polizaRawData.ciiuDescripcion ?? ""}`
            : "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Alicuota:"
          name="Alicuota"
          value={
            polizaRawData
              ? (Number(polizaRawData.alicuotaPagoILT) === 1
                  ? `ILT: 1-El Empleador paga ILT por cuenta y orden de la ART - Valor Fijo: $${polizaRawData.alicuotaSumaFija}`
                  : '-----')
              : '---'
          }
          fullWidth
          variant="standard"
        />
        <TextField
          label="Alicuota:"
          name="Alicuota"
          value={`Valor Variable: %${
            polizaRawData?.alicuotaCuotaVariable ?? 0
          } - Nivel: ${polizaRawData?.alicuotaNivel} - FFE: ${
            polizaRawData?.alicuotaFfe
          }`}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Nº Solicitud:"
          name="Solicitud"
          value={polizaRawData?.numeroSolicitud || "---"}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Operación:"
          name="Operacion"
          value={polizaRawData ? `${polizaRawData.codigoOperacion} - ${polizaRawData.operacionDescripcion}` : "---"}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Codigo Motivo Sorteo:"
          name="Sorteo"
          value={polizaRawData?.codigoMotivoSorteo || "---"}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Referencia ART:"
          name="Referencia"
          value={polizaRawData?.referenciaART || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Cuota Resultante:"
          name="CuotaResultante"
          value={polizaRawData?.cuotaResultante || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Cantidad de Trabajadores:"
          name="CantTrabajadores"
          value={polizaRawData?.cantTrabajadores || "---"}
          fullWidth
          variant="standard"
        />

        <TextField
          label="Masa Salarial:"
          name="Masa"
          value={polizaRawData?.masaSalarial || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Bonificación:"
          name="Bonificacion"
          value={polizaRawData?.bonificacion || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Clausula Penal"
          name="Clausula"
          value={polizaRawData?.clausulaPenal || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Unico Establecimiento"
          name="Establecimiento"
          value={polizaRawData?.unicoEstablecimiento || "---"}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Prestador Médico"
          name="Prestador"
          value={polizaRawData?.prestadorMedico ? "Si" : "No"}
          fullWidth
          variant="standard"
        />
      </div>
    </div>
  );
};

export default Poliza;
