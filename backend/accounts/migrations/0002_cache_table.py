from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    # Sign-in throttling counters (D-24). Idempotent: skips a table that already exists.
    call_command("createcachetable", database=schema_editor.connection.alias, verbosity=0)


def drop_cache_table(apps, schema_editor):
    schema_editor.execute("DROP TABLE IF EXISTS django_cache")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [migrations.RunPython(create_cache_table, drop_cache_table)]
