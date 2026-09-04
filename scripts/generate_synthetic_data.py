import csv
import random
from faker import Faker
import datetime
from pathlib import Path
import os

# Set seed for reproducibility
random.seed(42)
fake = Faker('en_IN')
Faker.seed(42)

DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

def generate_timestamp(start_date, end_date):
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    random_number_of_seconds = random.randrange(24*60*60)
    return start_date + datetime.timedelta(days=random_number_of_days, seconds=random_number_of_seconds)

def main():
    print("Generating synthetic data...")
    start_date = datetime.datetime(2025, 1, 1)
    end_date = datetime.datetime(2026, 1, 1)

    # 1. Generate Persons
    num_persons = 40
    persons = []
    
    # Roles distribution
    roles = (
        ['peddler'] * 5 +
        ['supplier'] * 3 +
        ['courier'] * 4 +
        ['financier'] * 1 + # P-0038
        ['associate'] * 1 + # P-0039
        ['contact'] * 26
    )
    
    cities = ['Mumbai', 'Pune', 'Nagpur']
    
    for i in range(1, num_persons + 1):
        pid = f"P-{i:04d}"
        role = roles[i-1] if i-1 < len(roles) else 'contact'
        
        # Override specific roles to match scenario
        if pid == 'P-0038':
            role = 'financier'
        elif pid == 'P-0039':
            role = 'associate'
        elif pid == 'P-0015':
            role = 'courier'
            
        name = fake.name()
        phone = fake.phone_number().replace(" ", "").replace("+91", "").replace("-", "")[-10:]
        address = fake.address().replace('\n', ', ')
        city = random.choice(cities)
        
        bail_status = 'none'
        prior_cases = ''
        
        if random.random() < 0.2 or role in ['peddler', 'supplier']:
            bail_status = random.choice(['on_bail', 'none', 'absconding'])
            num_cases = random.randint(1, 3)
            prior_cases = ';'.join([f"FIR-202{random.randint(2,5)}-{random.randint(100,999):03d}" for _ in range(num_cases)])
            
        # Duplicate Identity Case names mapping
        if pid == 'P-0001':
            name = 'Rajesh Kumar'
        elif pid == 'P-0010':
            name = 'Suresh Patil'
        elif pid == 'P-0020':
            name = 'Amit Sharma'
        elif pid == 'P-0005':
            name = 'Deepak Verma'

        persons.append({
            'person_id': pid,
            'name': name,
            'phone': phone,
            'address': address,
            'city': city,
            'bail_status': bail_status,
            'prior_cases': prior_cases,
            'role': role
        })
        
    # Write persons.csv
    persons_file = DATA_DIR / 'persons.csv'
    with open(persons_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=persons[0].keys())
        writer.writeheader()
        writer.writerows(persons)
        
    print(f"Generated {len(persons)} persons in {persons_file.name}")

    # Helper maps
    pid_to_person = {p['person_id']: p for p in persons}
    peddlers = [p for p in persons if p['role'] == 'peddler']
    suppliers = [p for p in persons if p['role'] == 'supplier']
    couriers = [p for p in persons if p['role'] == 'courier']
    contacts = [p for p in persons if p['role'] == 'contact']
    
    # Name aliases for duplicates
    def get_alias(pid, original_name):
        if pid == 'P-0001': return 'R. Kumar'
        if pid == 'P-0010': return 'S. Patil'
        if pid == 'P-0020': return 'Amit K. Sharma'
        if pid == 'P-0005': return 'D. Verma'
        return original_name

    # 2. Generate CDR Records
    cdr_records = []
    
    for i in range(150):
        caller = None
        callee = None
        
        # Scenario weights
        rand_val = random.random()
        if rand_val < 0.4:
            # Peddlers call suppliers
            caller = random.choice(peddlers)
            callee = random.choice(suppliers)
        elif rand_val < 0.7:
            # Couriers call peddlers/suppliers
            caller = random.choice(couriers)
            callee = random.choice(peddlers + suppliers)
        elif rand_val < 0.8:
            # Financier calls associate
            caller = pid_to_person['P-0038']
            callee = pid_to_person['P-0039']
        else:
            # Periphery contacts
            caller = random.choice(contacts)
            callee = random.choice(contacts + peddlers)
            
        caller_name = get_alias(caller['person_id'], caller['name']) if random.random() < 0.3 else caller['name']
        callee_name = get_alias(callee['person_id'], callee['name']) if random.random() < 0.3 else callee['name']
        
        ts = generate_timestamp(start_date, end_date)
        dur = random.randint(10, 600)
        
        cdr_records.append({
            'record_id': f"CDR-{i:04d}",
            'caller_id': caller['person_id'],
            'callee_id': callee['person_id'],
            'caller_phone': caller['phone'],
            'callee_phone': callee['phone'],
            'caller_name': caller_name,
            'callee_name': callee_name,
            'timestamp': ts.isoformat(),
            'duration_seconds': dur,
            'cell_tower_location': f"Tower-{random.randint(1, 50)}-{random.choice(cities)}"
        })
        
    cdr_file = DATA_DIR / 'cdr_records.csv'
    with open(cdr_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=cdr_records[0].keys())
        writer.writeheader()
        writer.writerows(cdr_records)
    print(f"Generated {len(cdr_records)} CDR records in {cdr_file.name}")

    # 3. Generate Financial Transactions
    financial_txns = []
    
    # The key demo transaction: financier sends money to an account linked to the seized-drugs FIR.
    # Receiver is P-0004, a peddler named in FIR-2026-0042 (the seized-drugs case).
    fin_tx = {
        'txn_id': "TXN-0000",
        'sender_id': "P-0038",
        'receiver_id': "P-0004",
        'sender_name': pid_to_person['P-0038']['name'],
        'receiver_name': pid_to_person['P-0004']['name'],
        'amount': 250000,
        'timestamp': generate_timestamp(start_date, end_date).isoformat(),
        'txn_type': 'bank_transfer',
        'account_ref': 'ACC-SEIZED-001'
    }
    financial_txns.append(fin_tx)
    
    # Second key transaction: financier sends a small inconspicuous amount to courier P-0015.
    # This individually looks like nothing, but combined with co-location data, crosses the threshold.
    fin_tx2 = {
        'txn_id': "TXN-0001",
        'sender_id': "P-0038",
        'receiver_id': "P-0015",
        'sender_name': pid_to_person['P-0038']['name'],
        'receiver_name': pid_to_person['P-0015']['name'],
        'amount': 8500,
        'timestamp': datetime.datetime(2025, 9, 15, 14, 30, 0).isoformat(),
        'txn_type': 'upi',
        'account_ref': f"ACC-{random.randint(1000,9999)}"
    }
    financial_txns.append(fin_tx2)
    
    # Third key transaction: another small payment from financier to courier — pattern of cash flow
    fin_tx3 = {
        'txn_id': "TXN-0002",
        'sender_id': "P-0038",
        'receiver_id': "P-0015",
        'sender_name': pid_to_person['P-0038']['name'],
        'receiver_name': pid_to_person['P-0015']['name'],
        'amount': 12000,
        'timestamp': datetime.datetime(2025, 10, 3, 11, 15, 0).isoformat(),
        'txn_type': 'cash_deposit',
        'account_ref': f"ACC-{random.randint(1000,9999)}"
    }
    financial_txns.append(fin_tx3)
    
    for i in range(1, 60):
        sender = random.choice(peddlers + suppliers + couriers + contacts)
        receiver = random.choice(peddlers + suppliers + couriers + contacts)
        while sender == receiver:
            receiver = random.choice(peddlers + suppliers + couriers + contacts)
            
        sender_name = get_alias(sender['person_id'], sender['name']) if random.random() < 0.3 else sender['name']
        receiver_name = get_alias(receiver['person_id'], receiver['name']) if random.random() < 0.3 else receiver['name']
        
        financial_txns.append({
            'txn_id': f"TXN-{i:04d}",
            'sender_id': sender['person_id'],
            'receiver_id': receiver['person_id'],
            'sender_name': sender_name,
            'receiver_name': receiver_name,
            'amount': random.randint(500, 15000),
            'timestamp': generate_timestamp(start_date, end_date).isoformat(),
            'txn_type': random.choice(['cash_deposit', 'bank_transfer', 'upi']),
            'account_ref': f"ACC-{random.randint(1000,9999)}"
        })
        
    fin_file = DATA_DIR / 'financial_transactions.csv'
    with open(fin_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=financial_txns[0].keys())
        writer.writeheader()
        writer.writerows(financial_txns)
    print(f"Generated {len(financial_txns)} financial records in {fin_file.name}")

    # 4. Generate Co-location logs
    colocation_logs = []
    
    # Critical 2 co-location events for financier (P-0038) and courier (P-0015)
    # Using recent timestamps (late 2025) so time decay doesn't reduce scores too much
    base_ts = datetime.datetime(2025, 10, 5, 16, 44, 9)
    ts1_start = base_ts
    ts1_end = base_ts + datetime.timedelta(minutes=45)
    
    ts2_start = base_ts + datetime.timedelta(days=21) # 3 weeks apart
    ts2_end = ts2_start + datetime.timedelta(minutes=30)
    
    event_idx = 1
    
    for p_id in ['P-0038', 'P-0015']:
        colocation_logs.extend([
            {
                'event_id': f"EVT-{event_idx:04d}",
                'person_id': p_id,
                'person_name': pid_to_person[p_id]['name'],
                'location_name': 'Crawford Market, Mumbai',
                'location_lat': 18.9481,
                'location_lon': 72.8338,
                'timestamp_start': ts1_start.isoformat(),
                'timestamp_end': ts1_end.isoformat()
            },
            {
                'event_id': f"EVT-{event_idx+1:04d}",
                'person_id': p_id,
                'person_name': pid_to_person[p_id]['name'],
                'location_name': 'Crawford Market, Mumbai',
                'location_lat': 18.9481,
                'location_lon': 72.8338,
                'timestamp_start': ts2_start.isoformat(),
                'timestamp_end': ts2_end.isoformat()
            }
        ])
    event_idx += 2
    
    # Random co-locations
    for _ in range((40 - 4) // 2):
        p1 = random.choice(peddlers + suppliers + couriers + contacts)
        p2 = random.choice(peddlers + suppliers + couriers + contacts)
        
        p1_name = get_alias(p1['person_id'], p1['name']) if random.random() < 0.3 else p1['name']
        p2_name = get_alias(p2['person_id'], p2['name']) if random.random() < 0.3 else p2['name']
        
        ts_start = generate_timestamp(start_date, end_date)
        ts_end = ts_start + datetime.timedelta(minutes=random.randint(15, 120))
        loc = fake.city()
        
        colocation_logs.extend([
            {
                'event_id': f"EVT-{event_idx:04d}",
                'person_id': p1['person_id'],
                'person_name': p1_name,
                'location_name': loc,
                'location_lat': round(random.uniform(18.0, 20.0), 4),
                'location_lon': round(random.uniform(72.0, 74.0), 4),
                'timestamp_start': ts_start.isoformat(),
                'timestamp_end': ts_end.isoformat()
            },
            {
                'event_id': f"EVT-{event_idx:04d}",
                'person_id': p2['person_id'],
                'person_name': p2_name,
                'location_name': loc,
                'location_lat': round(random.uniform(18.0, 20.0), 4),
                'location_lon': round(random.uniform(72.0, 74.0), 4),
                'timestamp_start': ts_start.isoformat(),
                'timestamp_end': ts_end.isoformat()
            }
        ])
        event_idx += 1
        
    coloc_file = DATA_DIR / 'colocation_logs.csv'
    with open(coloc_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=colocation_logs[0].keys())
        writer.writeheader()
        writer.writerows(colocation_logs)
    print(f"Generated {len(colocation_logs)} colocation logs in {coloc_file.name}")

    # 5. Generate FIR case mentions
    fir_mentions = []
    
    # Seized drugs FIR
    seized_fir = 'FIR-2026-0042'
    seized_people = random.sample(peddlers + couriers, 3)
    
    for i, p in enumerate(seized_people):
        p_name = get_alias(p['person_id'], p['name']) if random.random() < 0.3 else p['name']
        fir_mentions.append({
            'mention_id': f"FM-00{i+1}",
            'fir_id': seized_fir,
            'person_id': p['person_id'],
            'person_name': p_name,
            'role_in_case': 'accused',
            'fir_date': generate_timestamp(start_date, end_date).isoformat(),
            'fir_description': "Large cache of synthetic drugs seized at warehouse. Suspects arrested.",
            'linked_account_ref': 'ACC-SEIZED-001' # Important link to financier
        })
        
    # Other FIRs
    for i in range(22):
        p = random.choice(peddlers + suppliers + couriers + contacts)
        p_name = get_alias(p['person_id'], p['name']) if random.random() < 0.3 else p['name']
        
        fir_mentions.append({
            'mention_id': f"FM-{i+10:03d}",
            'fir_id': f"FIR-202{random.randint(5,6)}-{random.randint(100,999):04d}",
            'person_id': p['person_id'],
            'person_name': p_name,
            'role_in_case': random.choice(['accused', 'witness', 'suspect', 'informant']),
            'fir_date': generate_timestamp(start_date, end_date).isoformat(),
            'fir_description': fake.text(max_nb_chars=100).replace('\n', ' '),
            'linked_account_ref': ''
        })
        
    fir_file = DATA_DIR / 'fir_case_mentions.csv'
    with open(fir_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fir_mentions[0].keys())
        writer.writeheader()
        writer.writerows(fir_mentions)
    print(f"Generated {len(fir_mentions)} FIR mentions in {fir_file.name}")

if __name__ == '__main__':
    main()
