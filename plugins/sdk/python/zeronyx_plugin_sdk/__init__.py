"""
ZeroNyx Plugin SDK — Python Backend

Use this as the base class for your plugin's backend module.

Quick start:
    from zeronyx_plugin_sdk import ZeroNyxPlugin, PluginContext

    class MyPlugin(ZeroNyxPlugin):
        async def on_scan_complete(self, ctx: PluginContext, payload: dict):
            scan_id = payload.get("scan_id")
            results = await ctx.api.get_scan(scan_id)
            ...
"""

from .base import ZeroNyxPlugin, PluginContext

__all__ = ["ZeroNyxPlugin", "PluginContext"]
__version__ = "0.1.0"
