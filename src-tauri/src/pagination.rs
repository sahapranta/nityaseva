use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct PageParams {
    pub page: i64,
    pub page_size: i64,
}

impl PageParams {
    pub fn offset(&self) -> i64 {
        (self.page - 1) * self.page_size
    }

    pub fn limit(&self) -> i64 {
        self.page_size
    }
}

impl Default for PageParams {
    fn default() -> Self {
        Self { page: 1, page_size: 100 }
    }
}

#[derive(Serialize, Debug)]
pub struct PagedResult<T: Serialize> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

impl<T: Serialize> PagedResult<T> {
    pub fn new(data: Vec<T>, total: i64, params: &PageParams) -> Self {
        let total_pages = (total as f64 / params.page_size as f64).ceil() as i64;
        Self {
            data,
            total,
            page: params.page,
            page_size: params.page_size,
            total_pages,
        }
    }
}