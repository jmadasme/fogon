export const DEFAULT_STRICT_WORKFLOW_LABEL = "Fogón Courier Strict";

export function buildStrictFeatures({ enableNfc = false } = {}) {
  return [
    {
      feature: "OCR",
      config: {
        duplicated_user_action: "REVIEW",
        expiration_date_not_detected_action: "REVIEW",
        invalid_code_action: "REVIEW",
        invalid_mrz_action: "REVIEW",
        inconsistent_data_action: "REVIEW",
        invalid_validation_action: "REVIEW",
        expected_details_mismatch_action: "REVIEW",
        image_too_blurry_action: "REVIEW",
        image_too_dark_action: "REVIEW",
        image_too_bright_action: "REVIEW",
        document_or_personal_number_format_mismatch_action: "REVIEW",
        critical_field_occlusion_action: "REVIEW",
        document_without_portrait_action: "REVIEW",
        id_verification_injection_attack_action: "DECLINE",
        image_quality_too_low_action: "REVIEW",
        is_image_capture_review_screen_enabled: true,
      },
    },
    ...(enableNfc
      ? [
          {
            feature: "NFC",
            config: {
              allow_nfc_skip: true,
              skip_nfc_action: "REVIEW",
              unverified_chip_action: "DECLINE",
              trust_anchor_missing_action: "REVIEW",
            },
          },
        ]
      : []),
    {
      feature: "LIVENESS",
      config: {
        face_liveness_method: "ACTIVE_3D",
        face_liveness_flash_mode: "1",
        face_liveness_score_decline_threshold: 40,
        face_liveness_score_review_threshold: 65,
        face_liveness_possible_duplicated_face_action: "REVIEW",
        face_liveness_multiple_faces_action: "DECLINE",
        face_liveness_video_anomaly_action: "REVIEW",
        face_liveness_attack_face_match_action: "REVIEW",
        face_liveness_duplicated_face_name_mismatch_action: "REVIEW",
        face_liveness_duplicated_face_document_mismatch_action: "REVIEW",
        frame_injection_action: "DECLINE",
        screen_capture_action: "DECLINE",
        virtual_camera_action: "DECLINE",
        external_capture_device_action: "REVIEW",
        face_search_enabled: true,
      },
    },
    {
      feature: "FACE_MATCH",
      config: {
        face_match_score_decline_threshold: 45,
        face_match_score_review_threshold: 65,
        face_match_not_computed_action: "REVIEW",
      },
    },
    {
      feature: "AML",
      config: {
        aml_score_approve_threshold: 50,
        aml_score_review_threshold: 80,
        aml_match_score_threshold: 80,
      },
    },
    {
      feature: "IP_ANALYSIS",
      config: {
        vpn_detection_action: "REVIEW",
        duplicated_ip_action: "REVIEW",
        duplicated_device_action: "REVIEW",
        recovered_device_action: "REVIEW",
        automation_detected_action: "REVIEW",
        cross_org_fraud_device_action: "REVIEW",
        cross_org_fraud_ip_action: "REVIEW",
        device_app_tampered_action: "DECLINE",
        device_blocklist_action: "DECLINE",
        device_debugger_action: "REVIEW",
        device_emulator_action: "DECLINE",
        device_hooking_action: "DECLINE",
        device_integrity_missing_action: "NO_ACTION",
        device_rooted_action: "DECLINE",
        multiple_devices_action: "REVIEW",
        device_liveness_attack_history_action: "REVIEW",
        device_model_inconsistency_action: "REVIEW",
        ip_mismatch_action: "REVIEW",
      },
    },
  ];
}

export function buildStrictWorkflowPayload({
  publish = false,
  enableNfc = false,
} = {}) {
  return {
    workflow_label: DEFAULT_STRICT_WORKFLOW_LABEL,
    status: publish ? "published" : "draft",
    is_desktop_allowed: true,
    max_retry_attempts: 2,
    retry_window_days: 7,
    face_liveness_max_attempts: 2,
    face_match_max_attempts: 2,
    session_expiration_time: 3600,
    features: buildStrictFeatures({ enableNfc }),
  };
}
