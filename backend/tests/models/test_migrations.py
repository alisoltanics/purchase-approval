from django.core.management import call_command


def test_models_and_migrations_are_in_sync(db):
    call_command("makemigrations", "--check", "--dry-run")
