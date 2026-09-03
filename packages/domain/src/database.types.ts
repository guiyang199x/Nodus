export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          id: string
          initiator_user_id: string | null
          metadata: Json
          request_id: string
          result: string
          target_id: string | null
          target_type: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_kind: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          initiator_user_id?: string | null
          metadata?: Json
          request_id: string
          result: string
          target_id?: string | null
          target_type: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          initiator_user_id?: string | null
          metadata?: Json
          request_id?: string
          result?: string
          target_id?: string | null
          target_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_initiator_user_id_fkey"
            columns: ["initiator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_revisions: {
        Row: {
          byte_size: number
          created_at: string
          created_by: string
          declared_mime: string
          document_id: string
          id: string
          object_bucket: string
          object_path: string
          original_name: string
          state: Database["public"]["Enums"]["document_revision_state"]
          version_number: number
          workspace_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          created_by: string
          declared_mime: string
          document_id: string
          id?: string
          object_bucket?: string
          object_path: string
          original_name: string
          state?: Database["public"]["Enums"]["document_revision_state"]
          version_number?: number
          workspace_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          created_by?: string
          declared_mime?: string
          document_id?: string
          id?: string
          object_bucket?: string
          object_path?: string
          original_name?: string
          state?: Database["public"]["Enums"]["document_revision_state"]
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_revisions_workspace_id_document_id_fkey"
            columns: ["workspace_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          current_revision_id: string | null
          id: string
          status: Database["public"]["Enums"]["document_revision_state"]
          title: string
          updated_at: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_revision_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["document_revision_state"]
          title: string
          updated_at?: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_revision_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["document_revision_state"]
          title?: string
          updated_at?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_current_revision_fk"
            columns: ["workspace_id", "id", "current_revision_id"]
            isOneToOne: false
            referencedRelation: "document_revisions"
            referencedColumns: ["workspace_id", "document_id", "id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          removed_at: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          removed_at?: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          removed_at?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_workspace_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_workspace_fk"
            columns: ["last_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          document_id: string
          expected_mime: string
          expected_size: number
          expires_at: string
          id: string
          object_bucket: string
          object_path: string
          revision_id: string
          state: Database["public"]["Enums"]["upload_session_state"]
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          document_id: string
          expected_mime: string
          expected_size: number
          expires_at?: string
          id?: string
          object_bucket?: string
          object_path: string
          revision_id: string
          state?: Database["public"]["Enums"]["upload_session_state"]
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          expected_mime?: string
          expected_size?: number
          expires_at?: string
          id?: string
          object_bucket?: string
          object_path?: string
          revision_id?: string
          state?: Database["public"]["Enums"]["upload_session_state"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_sessions_workspace_id_document_id_fkey"
            columns: ["workspace_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "upload_sessions_workspace_id_document_id_revision_id_fkey"
            columns: ["workspace_id", "document_id", "revision_id"]
            isOneToOne: false
            referencedRelation: "document_revisions"
            referencedColumns: ["workspace_id", "document_id", "id"]
          },
          {
            foreignKeyName: "upload_sessions_workspace_id_revision_id_fkey"
            columns: ["workspace_id", "revision_id"]
            isOneToOne: false
            referencedRelation: "document_revisions"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          owner_user_id: string
          slug: string
          state: Database["public"]["Enums"]["workspace_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          owner_user_id: string
          slug: string
          state?: Database["public"]["Enums"]["workspace_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["workspace_kind"]
          name?: string
          owner_user_id?: string
          slug?: string
          state?: Database["public"]["Enums"]["workspace_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abort_upload_sessions: {
        Args: { correlation_id: string; target_session_ids: string[] }
        Returns: number
      }
      accept_invitation: {
        Args: { correlation_id: string; raw_token: string }
        Returns: string
      }
      assert_workspace_capability: {
        Args: {
          requested_capability: Database["public"]["Enums"]["app_capability"]
          target_workspace_id: string
        }
        Returns: {
          kind: Database["public"]["Enums"]["workspace_kind"]
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }[]
      }
      change_member_role: {
        Args: {
          correlation_id: string
          new_role: Database["public"]["Enums"]["workspace_role"]
          target_user_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      complete_upload_session: {
        Args: { correlation_id: string; target_session_id: string }
        Returns: {
          document_id: string
          revision_id: string
          status: Database["public"]["Enums"]["document_revision_state"]
        }[]
      }
      create_invitation: {
        Args: {
          correlation_id: string
          target_email: string
          target_role: Database["public"]["Enums"]["workspace_role"]
          target_workspace_id: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          raw_token: string
        }[]
      }
      create_team_workspace: {
        Args: {
          correlation_id: string
          workspace_name: string
          workspace_slug: string
        }
        Returns: string
      }
      create_upload_batch: {
        Args: {
          correlation_id: string
          input_files: Json
          target_workspace_id: string
        }
        Returns: {
          document_id: string
          expires_at: string
          object_path: string
          revision_id: string
          session_id: string
          workspace_id: string
        }[]
      }
      has_workspace_capability: {
        Args: {
          requested_capability: Database["public"]["Enums"]["app_capability"]
          target_workspace_id: string
        }
        Returns: boolean
      }
      leave_workspace: {
        Args: { correlation_id: string; target_workspace_id: string }
        Returns: undefined
      }
      remove_member: {
        Args: {
          correlation_id: string
          target_user_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      resolve_entry_workspace: { Args: never; Returns: string }
      revoke_invitation: {
        Args: {
          correlation_id: string
          target_invitation_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      set_last_workspace: {
        Args: { target_workspace_id: string }
        Returns: undefined
      }
      transfer_workspace_ownership: {
        Args: {
          correlation_id: string
          new_owner_user_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_capability:
        | "documents.read"
        | "documents.upload"
        | "documents.trash"
        | "documents.delete"
        | "jobs.reprocess"
        | "knowledge.write"
        | "comments.write"
        | "qa.publish"
        | "members.manage_basic"
        | "members.manage_admin"
        | "workspace.delete"
      document_revision_state:
        | "UPLOADING"
        | "QUEUED"
        | "VALIDATING"
        | "EXTRACTING"
        | "CHUNKING"
        | "ANALYZING"
        | "INDEXING"
        | "READY"
        | "RETRYING"
        | "FAILED"
        | "CANCELLED"
        | "SUPERSEDED"
      membership_status: "active" | "removed"
      upload_session_state: "pending" | "completed" | "aborted" | "expired"
      workspace_kind: "personal" | "team"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
      workspace_state: "ACTIVE" | "DELETION_SCHEDULED" | "PURGING" | "PURGED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_capability: [
        "documents.read",
        "documents.upload",
        "documents.trash",
        "documents.delete",
        "jobs.reprocess",
        "knowledge.write",
        "comments.write",
        "qa.publish",
        "members.manage_basic",
        "members.manage_admin",
        "workspace.delete",
      ],
      document_revision_state: [
        "UPLOADING",
        "QUEUED",
        "VALIDATING",
        "EXTRACTING",
        "CHUNKING",
        "ANALYZING",
        "INDEXING",
        "READY",
        "RETRYING",
        "FAILED",
        "CANCELLED",
        "SUPERSEDED",
      ],
      membership_status: ["active", "removed"],
      upload_session_state: ["pending", "completed", "aborted", "expired"],
      workspace_kind: ["personal", "team"],
      workspace_role: ["owner", "admin", "editor", "viewer"],
      workspace_state: ["ACTIVE", "DELETION_SCHEDULED", "PURGING", "PURGED"],
    },
  },
} as const

