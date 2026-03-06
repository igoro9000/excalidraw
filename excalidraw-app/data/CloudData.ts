import { createClient } from "@supabase/supabase-js";

import type { SavedScene } from "./LocalData";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

interface DrawingRow {
  id: string;
  name: string;
  elements: SavedScene["elements"];
  app_state: SavedScene["appState"];
  files: SavedScene["files"];
  created_at: number;
  modified_at: number;
}

export class CloudScenesAdapter {
  private static client = url && key ? createClient(url, key) : null;

  static isConfigured(): boolean {
    return !!this.client;
  }

  private static fromRow(row: DrawingRow): SavedScene {
    return {
      id: row.id,
      name: row.name,
      elements: row.elements,
      appState: row.app_state,
      files: row.files,
      created: row.created_at,
      modified: row.modified_at,
    };
  }

  static async list(): Promise<SavedScene[]> {
    const { data, error } = await this.client!.from("drawings")
      .select("*")
      .order("modified_at", { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as DrawingRow[]).map(this.fromRow);
  }

  static async get(id: string): Promise<SavedScene | null> {
    const { data, error } = await this.client!.from("drawings")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(error.message);
    }
    return this.fromRow(data as DrawingRow);
  }

  static async save(scene: SavedScene): Promise<void> {
    const row: DrawingRow = {
      id: scene.id,
      name: scene.name,
      elements: scene.elements,
      app_state: scene.appState,
      files: scene.files,
      created_at: scene.created,
      modified_at: scene.modified,
    };
    const { error } = await this.client!.from("drawings").upsert(row, {
      onConflict: "id",
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  static async delete(id: string): Promise<void> {
    const { error } = await this.client!.from("drawings").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
  }
}
