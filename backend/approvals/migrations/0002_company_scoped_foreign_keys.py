from django.db import migrations

# Django 5.2 has no composite foreign keys, so these two are created in SQL. They make the
# database refuse a requester or decider from another company (plan 3.2). The ORM keeps its
# single-column foreign keys; these constraints are an additional guard.
ADD = """
ALTER TABLE approvals_purchaserequest
    ADD CONSTRAINT pr_requester_same_company_fk
    FOREIGN KEY (company_id, requester_id) REFERENCES accounts_user (company_id, id),
    ADD CONSTRAINT pr_decider_same_company_fk
    FOREIGN KEY (company_id, decided_by_id) REFERENCES accounts_user (company_id, id);
"""
DROP = """
ALTER TABLE approvals_purchaserequest
    DROP CONSTRAINT pr_requester_same_company_fk,
    DROP CONSTRAINT pr_decider_same_company_fk;
"""


class Migration(migrations.Migration):
    dependencies = [("approvals", "0001_initial")]
    operations = [migrations.RunSQL(ADD, DROP)]
