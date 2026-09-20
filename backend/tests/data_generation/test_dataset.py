from app.data_generation.dataset import generate_employee_dataset


def test_generate_employee_dataset_returns_matching_employee_and_salary_counts() -> None:
    dataset = generate_employee_dataset(0)

    assert dataset.employees == []
    assert dataset.salaries == []


def test_generate_employee_dataset_generates_one_salary_per_employee() -> None:
    dataset = generate_employee_dataset(30, seed=7)

    assert len(dataset.employees) == 30
    assert len(dataset.salaries) == 30
    assert [s.employee_code for s in dataset.salaries] == [
        e.employee_code for e in dataset.employees
    ]


def test_generate_employee_dataset_is_reproducible_with_same_seed() -> None:
    first_run = generate_employee_dataset(200, seed=123)
    second_run = generate_employee_dataset(200, seed=123)

    assert first_run == second_run


def test_generate_employee_dataset_handles_ten_thousand_records() -> None:
    dataset = generate_employee_dataset(10_000, seed=1)

    assert len(dataset.employees) == 10_000
    assert len(dataset.salaries) == 10_000

    codes = [employee.employee_code for employee in dataset.employees]
    assert len(set(codes)) == 10_000
